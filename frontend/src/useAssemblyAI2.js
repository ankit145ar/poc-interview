import { useState, useRef } from 'react';
import { StreamingTranscriber } from 'assemblyai';
import RecordRTC from 'recordrtc';

const useAssemblyAI2 = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcripts, setTranscripts] = useState([]); // array of strings
  const [error, setError] = useState(null);

  const transcriberRef = useRef(null);
  const recorderRef = useRef(null);

  const startTranscription = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 🔹 Get token
      const response = await fetch('http://localhost:3001/token');
      const data = await response.json();
      if (!data.token) throw new Error('Token not received');

      // 🔹 Mic access
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setError('Microphone access denied');
        setIsLoading(false);
        return;
      }

      // 🔹 Transcriber (NO diarization, optimized latency)
      const transcriber = new StreamingTranscriber({
        token: data.token,
        sampleRate: 16000,
        speechModel: "u3-rt-pro",
        formatTurns: true,

        endOfTurnConfidenceThreshold: 0.4,
        minEndOfTurnSilenceWhenConfident: 100,
        maxTurnSilence: 400, // 🔥 faster turn detection
        vadThreshold: 0.4,

        speakerLabels: false, // ❌ removed diarization
        languageDetection: true,
      });

      transcriberRef.current = transcriber;

      // 🔹 Connection events
      transcriber.on('open', () => setIsConnected(true));
      transcriber.on('close', () => setIsConnected(false));

      transcriber.on('error', (err) => {
        console.error(err);
        setError(err.message || 'Streaming error');
        stopTranscription();
      });

      // 🔥 ULTRA-LOW-LATENCY HANDLER
      transcriber.on('turn', (turn) => {
        if (!turn.transcript) return;

        const text = turn.transcript;

        setTranscripts((prev) => {
          const updated = [...prev];

          if (!turn.end_of_turn) {
            // 🟡 PARTIAL → overwrite last line
            if (updated.length === 0) {
              updated.push(text);
            } else {
              updated[updated.length - 1] = text;
            }
          } else {
            // 🟢 FINAL → lock it + start new slot
            if (updated.length === 0) {
              updated.push(text);
            } else {
              updated[updated.length - 1] = text;
            }

            // prepare empty slot for next partial
            updated.push('');
          }

          return updated;
        });
      });

      await transcriber.connect();

      // 🔹 Recorder (PCM optimized)
      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm;codecs=pcm',
        recorderType: RecordRTC.StereoAudioRecorder,
        timeSlice: 250, // 🔥 lower = faster updates
        desiredSampRate: 16000,
        numberOfAudioChannels: 1,
        bufferSize: 4096,
        audioBitsPerSecond: 128000,

        ondataavailable: async (blob) => {
          try {
            if (!transcriberRef.current) return;

            const buffer = await blob.arrayBuffer();
            if (!buffer || buffer.byteLength === 0) return;

            const view = new Int16Array(buffer);
            if (!view.length) return;

            transcriberRef.current.sendAudio(view);
          } catch (err) {
            console.error('Audio processing error:', err);
          }
        },
      });

      recorderRef.current = recorder;
      recorder.startRecording();

      setIsRecording(true);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const stopTranscription = async () => {
    recorderRef.current?.stopRecording(() => {
      recorderRef.current?.destroy();
      recorderRef.current = null;
    });

    await transcriberRef.current?.close(true);
    transcriberRef.current = null;

    setIsRecording(false);
    setIsConnected(false);
  };

  return {
    isRecording,
    isLoading,
    isConnected,
    transcripts,
    error,
    startTranscription,
    stopTranscription,
  };
};

export default useAssemblyAI2;