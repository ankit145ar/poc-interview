import React, { useEffect, useRef, useState } from "react";

const UploadTranscriberUI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);
  const transcriptsRef = useRef(transcripts);
  const fileInputRef = useRef(null);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  useEffect(() => {
    if (!transcripts.length) return;
    fetchQuestions();
  }, [transcripts]);

  useEffect(() => {
    return () => {
      if (audioPreview && audioPreview.startsWith("blob:")) {
        URL.revokeObjectURL(audioPreview);
      }
    };
  }, [audioPreview]);

  const getLastWords = (items, wordCount = 50) => {
    const text = items.filter(Boolean).join(" ").trim();
    if (!text) return "";
    const words = text.split(/\s+/);
    return words.slice(-wordCount).join(" ");
  };

  const fetchQuestions = async () => {
    const context = getLastWords(transcriptsRef.current, 50);
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

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAudio(file);
  };

  const uploadAudio = async (file) => {
    setError(null);
    setIsLoading(true);
    setQuestions([]);
    setTranscripts([]);
    setAudioPreview(null);

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const response = await fetch("http://localhost:3001/upload-audio", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      const transcriptLines = Array.isArray(data.transcriptLines)
        ? data.transcriptLines
        : typeof data.fullText === "string"
        ? data.fullText.split(/\r?\n/).filter(Boolean)
        : [];

      setTranscripts(transcriptLines.length ? transcriptLines : [data.fullText || ""]);

      if (data.audioUrl) {
        setAudioPreview(data.audioUrl);
      } else {
        setAudioPreview(URL.createObjectURL(file));
      }
    } catch (err) {
      console.error("Upload failed:", err);
      setError(err.message || "Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  const clearState = () => {
    setTranscripts([]);
    setQuestions([]);
    setError(null);
    setAudioPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <label style={styles.uploadLabel}>
          {isLoading ? "Uploading..." : "Upload MP3"}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/*"
            onChange={handleFileChange}
            style={styles.fileInput}
            disabled={isLoading}
          />
        </label>
        <button onClick={clearState} style={styles.clearBtn} disabled={isLoading}>
          Clear
        </button>
      </div>

      {audioPreview && (
        <div style={styles.audioPreview}>
          <audio controls src={audioPreview} style={{ width: "100%" }} />
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      <div style={{ display: "flex", flex: "1" }}>
        <div style={styles.transcriptBox}>
          {transcripts.length > 0 ? (
            transcripts.map((line, i) => (
              <p key={i} style={styles.line}>
                {line}
              </p>
            ))
          ) : (
            <p style={styles.noQuestions}>
              Choose an MP3 and the transcript will appear here.
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
              Questions will appear here after transcription completes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadTranscriberUI;

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
    alignItems: "center",
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

  clearBtn: {
    padding: "10px 20px",
    fontSize: "16px",
    background: "#edf2f7",
    border: "1px solid #cbd5e0",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#2d3748",
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
