import React, { useEffect, useRef, useState } from "react";
import RecordRTC from "recordrtc";
import { StreamingTranscriber } from "assemblyai";

const UploadPlaybackTranscriberUI = () => {
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);

  const audioRef = useRef(null);
  const transcriberRef = useRef(null);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const transcriptsRef = useRef(transcripts);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const audioBufferRef = useRef(null);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  useEffect(() => {
    if (!isPlaying) return;

    fetchQuestions();
    timerRef.current = setInterval(fetchQuestions, 15000);

    return () => clearInterval(timerRef.current);
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      cleanupPlaybackStream();
      URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const getLastWords = (items, wordCount = 100) => {
    const text = items.filter(Boolean).join(" ").trim();
    if (!text) return "";
    const words = text.split(/\s+/);
    return words.slice(-wordCount).join(" ");
  };

  const fetchQuestions = async () => {
    const context = getLastWords(transcriptsRef.current, 100);
    if (!context) return;

    try {
      const response = await fetch("http://localhost:3001/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcribe: context }),
      });

      const data = await response.json();
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (err) {
      console.error("Question fetch failed:", err);
      setError("Unable to generate questions.");
    }
  };

  const initializeTranscriber = async () => {
    const response = await fetch("http://localhost:3001/token");
    const data = await response.json();
    if (!data.token) throw new Error("Token not received");

    audioBufferRef.current = null;
    const transcriber = new StreamingTranscriber({
      token: data.token,
      sampleRate: 16000,
      speechModel: "u3-rt-pro",
      formatTurns: true,
      endOfTurnConfidenceThreshold: 0.6,
      minEndOfTurnSilenceWhenConfident: 50,
      maxTurnSilence: 250,
      vadThreshold: 0.5,
      speakerLabels: false,
      languageDetection: true,
    });

    transcriberRef.current = transcriber;

    transcriber.on("open", () => {
      setError(null);
    });

    transcriber.on("close", () => {
      setIsPlaying(false);
    });

    transcriber.on("error", (err) => {
      console.error(err);
      setError(err.message || "Streaming error");
      stopPlayback();
    });

    transcriber.on("turn", (turn) => {
      if (!turn.transcript) return;

      const text = turn.transcript;
      setTranscripts((prev) => {
        const updated = [...prev];

        if (!turn.end_of_turn) {
          if (updated.length === 0) {
            updated.push(text);
          } else {
            updated[updated.length - 1] = text;
          }
        } else {
          if (updated.length === 0) {
            updated.push(text);
          } else {
            updated[updated.length - 1] = text;
          }
          updated.push("");
        }

        return updated;
      });
    });

    await transcriber.connect();
  };

  const createPlaybackStream = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return null;

    let stream = null;
    if (typeof audioEl.captureStream === "function") {
      try {
        stream = audioEl.captureStream();
      } catch (err) {
        console.warn("captureStream failed:", err);
      }
    }

    if ((!stream || stream.getAudioTracks().length === 0) && typeof audioEl.mozCaptureStream === "function") {
      try {
        stream = audioEl.mozCaptureStream();
      } catch (err) {
        console.warn("mozCaptureStream failed:", err);
      }
    }

    if (stream && stream.getAudioTracks().length > 0) {
      return stream;
    }

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const sourceNode = audioContext.createMediaElementSource(audioEl);
    const destination = audioContext.createMediaStreamDestination();
    sourceNode.connect(destination);
    sourceNode.connect(audioContext.destination);
    audioContextRef.current = audioContext;
    sourceNodeRef.current = sourceNode;
    return destination.stream;
  };

  const createRecorder = (stream, handleChunk) => {
    const recorderOptions = {
      type: "audio",
      mimeType: "audio/webm;codecs=pcm",
      recorderType: RecordRTC.StereoAudioRecorder,
      timeSlice: 50,
      desiredSampRate: 16000,
      numberOfAudioChannels: 1,
      bufferSize: 4096,
      audioBitsPerSecond: 128000,
      ondataavailable: async (blob) => {
        if (!blob) return;
        try {
          const buffer = await blob.arrayBuffer();
          const view = new Int16Array(buffer);
          handleChunk(view);
        } catch (err) {
          console.error("RecordRTC processing error:", err);
        }
      },
    };

    try {
      return new RecordRTC(stream, recorderOptions);
    } catch (err) {
      console.warn("RecordRTC unavailable, falling back to MediaRecorder:", err);
    }

    if (!window.MediaRecorder) {
      throw new Error("No supported audio recorder available in this browser.");
    }

    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorder.ondataavailable = async (event) => {
      if (!event.data || event.data.size === 0) return;
      try {
        const buffer = await event.data.arrayBuffer();
        const view = new Int16Array(buffer);
        handleChunk(view);
      } catch (err) {
        console.error("MediaRecorder processing error:", err);
      }
    };

    return {
      startRecording: () => mediaRecorder.start(50),
      stopRecording: (callback) => {
        mediaRecorder.onstop = callback;
        mediaRecorder.stop();
      },
      destroy: () => {
        mediaRecorder.ondataavailable = null;
        mediaRecorder.onstop = null;
      },
    };
  };

  const cleanupPlaybackStream = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (err) {
        console.warn(err);
      }
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (err) {
        console.warn(err);
      }
      audioContextRef.current = null;
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioUrl(url);
    setTranscripts([]);
    setQuestions([]);
    setError(null);
    audioBufferRef.current = null;
  };

  const startPlayback = async () => {
    if (!audioUrl) {
      setError("Please upload an MP3 file first.");
      return;
    }

    setError(null);
    setIsLoading(true);
    setTranscripts([]);
    setQuestions([]);

    try {
      await initializeTranscriber();

      const stream = createPlaybackStream();
      if (!stream) {
        throw new Error("Unable to capture audio from playback.");
      }

      const handleAudioChunk = async (view) => {
        if (!transcriberRef.current || !view || !view.length) return;

        const maxSamples = 16000;
        const minSamples = 400;
        const pending = audioBufferRef.current;
        const combined = pending ? new Int16Array(pending.length + view.length) : view;

        if (pending) {
          combined.set(pending, 0);
          combined.set(view, pending.length);
        }

        let offset = 0;
        while (offset + minSamples <= combined.length) {
          const end = Math.min(offset + maxSamples, combined.length);
          const slice = combined.subarray(offset, end);
          transcriberRef.current.sendAudio(slice);
          offset = end;
        }

        audioBufferRef.current = combined.subarray(offset);
      };

      const recorder = createRecorder(stream, handleAudioChunk);
      if (!recorder) {
        throw new Error("Unable to create a recorder for playback stream.");
      }

      recorderRef.current = recorder;
      recorder.startRecording();

      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error(err);
      setError(err.message || "Playback transcription failed.");
      stopPlayback();
    } finally {
      setIsLoading(false);
    }
  };

  const stopPlayback = async () => {
    timerRef.current && clearInterval(timerRef.current);
    recorderRef.current?.stopRecording(() => {
      recorderRef.current?.destroy();
      recorderRef.current = null;
    });

    await transcriberRef.current?.close(true);
    transcriberRef.current = null;
    cleanupPlaybackStream();

    if (audioRef.current) {
      audioRef.current.pause();
    }

    audioBufferRef.current = null;
    setIsPlaying(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <label style={styles.uploadLabel}>
          {isLoading ? "Loading..." : "Upload MP3"}
          <input
            type="file"
            accept="audio/mpeg,audio/mp3"
            onChange={handleFileChange}
            style={styles.fileInput}
            disabled={isLoading}
          />
        </label>
        <button
          onClick={isPlaying ? stopPlayback : startPlayback}
          disabled={isLoading || !audioUrl}
          style={isPlaying ? styles.stopBtn : styles.startBtn}
        >
          {isPlaying ? "Stop" : "Play & Transcribe"}
        </button>
      </div>

      {audioUrl && (
        <div style={styles.audioPreview}>
          <audio ref={audioRef} controls src={audioUrl} style={{ width: "100%" }} />
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      <div style={{ display: "flex", flex: "1" }}>
        <div style={styles.transcriptBox}>
          {transcripts.length > 0 ? (
            transcripts.map((line, index) => (
              <p key={index} style={styles.line}>
                {line}
              </p>
            ))
          ) : (
            <p style={styles.noQuestions}>
              Upload an MP3 and press Play to transcribe in real time.
            </p>
          )}
        </div>

        <div style={styles.questionsBox}>
          <h3 style={styles.questionsTitle}>Suggested Questions</h3>
          {questions.length > 0 ? (
            <ul style={styles.questionList}>
              {questions.map((question, index) => (
                <li key={index} style={styles.questionItem}>
                  {question}
                </li>
              ))}
            </ul>
          ) : (
            <p style={styles.noQuestions}>
              Questions appear every 15 seconds from the latest transcript.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPlaybackTranscriberUI;

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "sans-serif",
    background: "#ffffff",
    color: "#1a202c",
  },
  topBar: {
    padding: "16px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    background: "#f7fafc",
  },
  uploadLabel: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#3182ce",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: "8px",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
  },
  fileInput: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
  },
  startBtn: {
    padding: "10px 20px",
    fontSize: "16px",
    background: "#48bb78",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#ffffff",
  },
  stopBtn: {
    padding: "10px 20px",
    fontSize: "16px",
    background: "#f56565",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#ffffff",
  },
  audioPreview: {
    padding: "16px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f7fafc",
  },
  transcriptBox: {
    flex: 1,
    padding: "20px",
    overflowY: "auto",
    background: "#ffffff",
  },
  questionsBox: {
    width: "380px",
    padding: "20px",
    borderTop: "1px solid #e2e8f0",
    background: "#f7fafc",
  },
  questionsTitle: {
    margin: 0,
    marginBottom: "12px",
    fontSize: "18px",
    color: "#2d3748",
  },
  questionList: {
    listStyleType: "decimal",
    paddingLeft: "20px",
    margin: 0,
  },
  questionItem: {
    marginBottom: "10px",
    lineHeight: 1.6,
    color: "#1a202c",
  },
  noQuestions: {
    color: "#718096",
    margin: 0,
    fontStyle: "italic",
  },
  line: {
    marginBottom: "10px",
    lineHeight: "1.5",
    fontSize: "16px",
    color: "#1a202c",
  },
  error: {
    color: "#e53e3e",
    textAlign: "center",
    marginTop: "10px",
  },
};
