// import { useState, useRef, useEffect } from 'react';
// import { AssemblyAI, StreamingTranscriber } from 'assemblyai';
// import RecordRTC from 'recordrtc';

// const useAssemblyAI = () => {
//   const [isRecording, setIsRecording] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [transcripts, setTranscripts] = useState([]);
//   const [error, setError] = useState(null);
//   const transcriberRef = useRef(null);
//   const recorderRef = useRef(null);

//   const startTranscription = async () => {
//     try {
//       setIsLoading(true);
//       setError(null);
//       // Fetch token from backend
//       const response = await fetch('http://localhost:3001/token');
//       const data = await response.json();

//       if (!data.token) {
//         throw new Error('Failed to retrieve token from server');
//       }

//       // Get Microphone Access
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

//       // Initialize transcriber with real-time speaker diarization
//       const transcriber = new StreamingTranscriber({
//         token: data.token,
//         sampleRate: 16000,
//         speechModel: "u3-rt-pro",
//         formatTurns: true,
//         endOfTurnConfidenceThreshold: 0.4,
//         minEndOfTurnSilenceWhenConfident: 100,
//         maxTurnSilence: 1000,
//         vadThreshold: 0.4,
//         speakerLabels: true,
//         languageDetection: true,
//       });
//       transcriberRef.current = transcriber;

//       transcriber.on('open', ({ sessionId }) => {
//         console.log(`Session opened with ID: ${sessionId}`);
//       });

//       transcriber.on('error', (error) => {
//         console.error('Transcriber error:', error);
//         setError(error.message);
//         stopTranscription();
//       });

//       transcriber.on('close', (code, reason) => {
//         console.log('Session closed:', code, reason);
//       });

//       transcriber.on('turn', (turn) => {
//         if (!turn.transcript) return;
        
//         // V3 Real-time provides 'turn' events where end_of_turn signifies finality.
//         const isPartial = !turn.end_of_turn;
//         const speaker = turn.speaker_label || 'Unknown';
//         const transcriptText = turn.transcript;

//         setTranscripts(prev => {
//           const newTranscripts = [...prev];
//           const last = newTranscripts[newTranscripts.length - 1];
          
//           if (last && last.isPartial) {
//             // Replace the last partial transcript with this update
//             newTranscripts[newTranscripts.length - 1] = {
//               id: turn.turn_start || Date.now(),
//               text: transcriptText,
//               speaker: speaker,
//               isPartial: isPartial
//             };
//           } else {
//             // Start a new sequence
//             newTranscripts.push({ 
//               id: turn.turn_start || Date.now(),
//               text: transcriptText,
//               speaker: speaker,
//               isPartial: isPartial
//             });
//           }
//           return newTranscripts;
//         });
//       });

//       await transcriber.connect();

//       // Setup RecordRTC for capturing precise 16000Hz PCM data
//       const recorder = new RecordRTC(stream, {
//         type: 'audio',
//         mimeType: 'audio/webm;codecs=pcm', // AssemblyAI works well with raw PCM
//         recorderType: RecordRTC.StereoAudioRecorder,
//         timeSlice: 250,
//         desiredSampRate: 16000,
//         numberOfAudioChannels: 1,
//         bufferSize: 4096,
//         audioBitsPerSecond: 128000,
//         ondataavailable: async (blob) => {
//           if (!transcriberRef.current) return;
//           // Send raw blob to API via socket by converting to array buffer
//           const buffer = await blob.arrayBuffer();
//           const view = new Int16Array(buffer);
//           // transcriber expects base64 or raw string depending on the SDK version
//           // Actually, AssemblyAI web SDK `sendAudio` takes Uint8Array or Int16Array usually
//           // wait, the web SDK works best taking `Int16Array` or binary
//           transcriberRef.current.sendAudio(view);
//         }
//       });

//       recorderRef.current = recorder;
//       recorder.startRecording();
//       setIsRecording(true);

//     } catch (err) {
//       console.log(err);
//       console.error(err);
//       setError(err.message);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const stopTranscription = async () => {
//     if (recorderRef.current) {
//       recorderRef.current.stopRecording(() => {
//         recorderRef.current.destroy();
//         recorderRef.current = null;
//       });
//     }

//     if (transcriberRef.current) {
//       await transcriberRef.current.close(true);
//       transcriberRef.current = null;
//     }
//     setIsRecording(false);
//   };

//   return { isRecording, isLoading, startTranscription, stopTranscription, transcripts, error };
// };

// export default useAssemblyAI;


































// import { useState, useRef } from 'react';
// import { StreamingTranscriber } from 'assemblyai';
// import RecordRTC from 'recordrtc';

// const useAssemblyAI = () => {
//   const [isRecording, setIsRecording] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isConnected, setIsConnected] = useState(false);
//   const [transcripts, setTranscripts] = useState([]);
//   const [questions, setQuestions] = useState([]);
//   const [error, setError] = useState(null);

//   const transcriberRef = useRef(null);
//   const recorderRef = useRef(null);
//   const conversationRef = useRef([]);
//   const speakerMapRef = useRef({});
// const speakerCountRef = useRef(0);
// const lastSpeakerRef = useRef(null);

//   // ✅ Role detection
//   const detectRole = (text) => {
//     if (text.trim().endsWith('?')) return 'interviewer';
//     return 'candidate';
//   };

//   // ✅ Question API
//   const generateQuestions = async (conversation) => {
//     try {
//       const res = await fetch('http://localhost:3001/generate-questions', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ conversation }),
//       });

//       const data = await res.json();
//       setQuestions(data.questions || []);
//     } catch (err) {
//       console.error('Question API error:', err);
//     }
//   };

//   const startTranscription = async () => {
//     try {
//       setIsLoading(true);
//       setError(null);

//       // 🔹 Get token
//       const response = await fetch('http://localhost:3001/token');
//       const data = await response.json();    

//       if (!data.token) throw new Error('Token not received');

//       // 🔹 Mic access
//       let stream;
//       try {
//         stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       } catch {
//         setError('Microphone access denied');
//         setIsLoading(false);
//         return;
//       }

//       // 🔹 Transcriber
//       const transcriber = new StreamingTranscriber({
//         // token: data.token,
//         // sampleRate: 16000,
//         // formatTurns: true,
//         // speakerLabels: true,

//                 token: data.token,
//         sampleRate: 16000,
//         speechModel: "u3-rt-pro",
//         formatTurns: true,
//         endOfTurnConfidenceThreshold: 0.4,
//         minEndOfTurnSilenceWhenConfident: 100,
//         maxTurnSilence: 1000,
//         vadThreshold: 0.4,
//         speakerLabels: true,
//         languageDetection: true,
//       });

//       transcriberRef.current = transcriber;

//       // ✅ Events
//       transcriber.on('open', () => {
//         setIsConnected(true);
//       });

//       transcriber.on('close', () => {
//         setIsConnected(false);
//       });

//       transcriber.on('error', (err) => {
//         console.error(err);
//         setError(err.message || 'Streaming error');
//         stopTranscription();
//       });

//       // ✅ Transcript handling (FINAL ONLY)
//       transcriber.on('turn', (turn) => {
//         if (!turn.transcript || !turn.end_of_turn) return;

//         const text = turn.transcript.trim();

//         // UI update
//         setTranscripts((prev) => [
//           ...prev,
//           {
//             id: Date.now(),
//             text,
//             speaker: turn.speaker_label || 'A',
//           },
//         ]);

//         // Conversation buffer
//         const role = detectRole(text);

//         conversationRef.current.push({ role, text });

//         if (conversationRef.current.length > 10) {
//           conversationRef.current.shift();
//         }

//         // Generate questions every 4 turns
//         if (conversationRef.current.length % 4 === 0) {
//           generateQuestions(conversationRef.current);
//         }
//       });

//       await transcriber.connect();

//       // 🔥 KEEP YOUR WORKING SETUP (PCM)
//       const recorder = new RecordRTC(stream, {
//         type: 'audio',
//         mimeType: 'audio/webm;codecs=pcm',
//         recorderType: RecordRTC.StereoAudioRecorder,
//         timeSlice: 250,
//         desiredSampRate: 16000,
//         numberOfAudioChannels: 1,
//         bufferSize: 4096,
//         audioBitsPerSecond: 128000,

//         ondataavailable: async (blob) => {
//           try {
//             if (!transcriberRef.current) return;

//             const buffer = await blob.arrayBuffer();

//             // ✅ Safety checks (prevents your crash)
//             if (!buffer || buffer.byteLength === 0) return;

//             const view = new Int16Array(buffer);

//             if (!view.length) return;

//             transcriberRef.current.sendAudio(view);
//           } catch (err) {
//             console.error('Audio processing error:', err);
//           }
//         },
//       });

//       recorderRef.current = recorder;
//       recorder.startRecording();

//       setIsRecording(true);
//     } catch (err) {
//       console.error(err);
//       setError(err.message);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const stopTranscription = async () => {
//     recorderRef.current?.stopRecording(() => {
//       recorderRef.current?.destroy();
//       recorderRef.current = null;
//     });

//     await transcriberRef.current?.close(true);
//     transcriberRef.current = null;

//     setIsRecording(false);
//     setIsConnected(false);
//   };

//   return {
//     isRecording,
//     isLoading,
//     isConnected,
//     transcripts,
//     questions,
//     error,
//     startTranscription,
//     stopTranscription,
//   };
// };

// export default useAssemblyAI;



























































// Inteviwer & Candidate
// import { useState, useRef } from 'react';
// import { StreamingTranscriber } from 'assemblyai';
// import RecordRTC from 'recordrtc';

// const useAssemblyAI = () => {
//   const [isRecording, setIsRecording] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isConnected, setIsConnected] = useState(false);
//   const [transcripts, setTranscripts] = useState([]);
//   const [questions, setQuestions] = useState([]);
//   const [error, setError] = useState(null);

//   const transcriberRef = useRef(null);
//   const recorderRef = useRef(null);
//   const conversationRef = useRef([]);

//   // ✅ NEW: Speaker mapping
//   const speakerMapRef = useRef({});
//   const speakerCountRef = useRef(0);
//   const lastSpeakerRef = useRef(null);

//   // ✅ Role detection (unchanged)
//   const detectRole = (text) => {
//     if (text.trim().endsWith('?')) return 'interviewer';
//     return 'candidate';
//   };

//   // ✅ Map A/B/UNKNOWN → Speaker 1/2
//   const getSpeaker = (label) => {
//     if (!label || label === 'UNKNOWN') return null;

//     if (!speakerMapRef.current[label]) {
//       speakerCountRef.current += 1;
//       speakerMapRef.current[label] = `Speaker ${speakerCountRef.current}`;
//     }

//     return speakerMapRef.current[label];
//   };

//   // ✅ Question API
//   const generateQuestions = async (conversation) => {
//     try {
//       const res = await fetch('http://localhost:3001/generate-questions', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ conversation }),
//       });

//       const data = await res.json();
//       setQuestions(data.questions || []);
//     } catch (err) {
//       console.error('Question API error:', err);
//     }
//   };

//   const startTranscription = async () => {
//     try {
//       setIsLoading(true);
//       setError(null);

//       const response = await fetch('http://localhost:3001/token');
//       const data = await response.json();

//       if (!data.token) throw new Error('Token not received');

//       let stream;
//       try {
//         stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       } catch {
//         setError('Microphone access denied');
//         setIsLoading(false);
//         return;
//       }

//       // ❗ DO NOT CHANGE (as per your instruction)
//       const transcriber = new StreamingTranscriber({
//         token: data.token,
//         sampleRate: 16000,
//         speechModel: "u3-rt-pro",
//         formatTurns: true,
//         endOfTurnConfidenceThreshold: 0.4,
//         minEndOfTurnSilenceWhenConfident: 100,
//         maxTurnSilence: 1000,
//         vadThreshold: 0.4,
//         speakerLabels: true,
//         languageDetection: true,
//       });

//       transcriberRef.current = transcriber;

//       transcriber.on('open', () => {
//         setIsConnected(true);
//       });

//       transcriber.on('close', () => {
//         setIsConnected(false);
//       });

//       transcriber.on('error', (err) => {
//         console.error(err);
//         setError(err.message || 'Streaming error');
//         stopTranscription();
//       });

//       // ✅ UPDATED TURN HANDLER (main fix)
//       transcriber.on('turn', (turn) => {
//         if (!turn.transcript || !turn.end_of_turn) return;

//         const text = turn.transcript.trim();

//         // 🔹 Normalize speaker
//         let speaker = getSpeaker(turn.speaker_label);

//         if (!speaker) {
//           speaker = lastSpeakerRef.current || 'Speaker 1';
//         } else {
//           lastSpeakerRef.current = speaker;
//         }

//         // 🔹 Role detection
//         const role = detectRole(text);

//         // 🔹 UI transcript
//         setTranscripts((prev) => [
//           ...prev,
//           {
//             id: Date.now(),
//             text,
//             speaker, // Speaker 1/2
//             role,    // interviewer/candidate
//           },
//         ]);

//         // 🔹 Conversation buffer (for AI)
//         conversationRef.current.push({ role, text });

//         if (conversationRef.current.length > 10) {
//           conversationRef.current.shift();
//         }

//         if (conversationRef.current.length % 4 === 0) {
//           generateQuestions(conversationRef.current);
//         }
//       });

//       await transcriber.connect();

   
//       const recorder = new RecordRTC(stream, {
//         type: 'audio',
//         mimeType: 'audio/webm;codecs=pcm',
//         recorderType: RecordRTC.StereoAudioRecorder,
//         timeSlice: 750,
//         desiredSampRate: 16000,
//         numberOfAudioChannels: 1,
//         bufferSize: 4096,
//         audioBitsPerSecond: 128000,

//         ondataavailable: async (blob) => {
//           try {
//             if (!transcriberRef.current) return;

//             const buffer = await blob.arrayBuffer();
//             if (!buffer || buffer.byteLength === 0) return;

//             const view = new Int16Array(buffer);
//             if (!view.length) return;

//             transcriberRef.current.sendAudio(view);
//           } catch (err) {
//             console.error('Audio processing error:', err);
//           }
//         },
//       });

//       recorderRef.current = recorder;
//       recorder.startRecording();

//       setIsRecording(true);
//     } catch (err) {
//       console.error(err);
//       setError(err.message);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const stopTranscription = async () => {
//     recorderRef.current?.stopRecording(() => {
//       recorderRef.current?.destroy();
//       recorderRef.current = null;
//     });

//     await transcriberRef.current?.close(true);
//     transcriberRef.current = null;

//     setIsRecording(false);
//     setIsConnected(false);
//   };

//   return {
//     isRecording,
//     isLoading,
//     isConnected,
//     transcripts,
//     questions,
//     error,
//     startTranscription,
//     stopTranscription,
//   };
// };

// export default useAssemblyAI;




import { useState, useRef } from 'react';
import { StreamingTranscriber } from 'assemblyai';
import RecordRTC from 'recordrtc';

const useAssemblyAI = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);

  const transcriberRef = useRef(null);
  const recorderRef = useRef(null);
  const conversationRef = useRef([]);

  // ✅ Speaker map (A → Speaker 1, B → Speaker 2, etc.)
  const speakerMapRef = useRef({});
  const speakerCountRef = useRef(0);

  const getSpeaker = (label) => {
    if (!label || label === 'UNKNOWN') return 'Unknown';

    if (!speakerMapRef.current[label]) {
      speakerCountRef.current += 1;
      speakerMapRef.current[label] = `Speaker ${speakerCountRef.current}`;
    }

    return speakerMapRef.current[label];
  };

  // (you can still keep role detection for questions only)
  const detectRole = (text) => {
    if (text.trim().endsWith('?')) return 'interviewer';
    return 'candidate';
  };

  const generateQuestions = async (conversation) => {
    try {
      const res = await fetch('http://localhost:3001/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation }),
      });

      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('Question API error:', err);
    }
  };

  const startTranscription = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('http://localhost:3001/token');
      const data = await response.json();

      if (!data.token) throw new Error('Token not received');

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setError('Microphone access denied');
        setIsLoading(false);
        return;
      }

      const transcriber = new StreamingTranscriber({
        token: data.token,
        sampleRate: 16000,
        speechModel: "u3-rt-pro",
        formatTurns: true,
        endOfTurnConfidenceThreshold: 0.4,
        minEndOfTurnSilenceWhenConfident: 100,
        maxTurnSilence: 600,
        vadThreshold: 0.4,
        speakerLabels: true,
        languageDetection: true,
      });

      transcriberRef.current = transcriber;

      transcriber.on('open', () => {
        setIsConnected(true);
      });

      transcriber.on('close', () => {
        setIsConnected(false);
      });

      transcriber.on('error', (err) => {
        console.error(err);
        setError(err.message || 'Streaming error');
        stopTranscription();
      });

      // ✅ PURE diarization handling
      transcriber.on('turn', (turn) => {
        if (!turn.transcript || !turn.end_of_turn) return;

        const text = turn.transcript.trim();

        const speaker = getSpeaker(turn.speaker_label);

        const role = detectRole(text); // only for AI, not UI

        setTranscripts((prev) => [
          ...prev,
          {
            id: Date.now(),
            text,
            speaker, // Speaker 1, 2, 3...
          },
        ]);

        // for AI question generation
        conversationRef.current.push({ role, text });

        if (conversationRef.current.length > 10) {
          conversationRef.current.shift();
        }

        if (conversationRef.current.length % 4 === 0) {
          generateQuestions(conversationRef.current);
        }
      });

      await transcriber.connect();

      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm;codecs=pcm',
        recorderType: RecordRTC.StereoAudioRecorder,
        timeSlice: 750,
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
    questions,
    error,
    startTranscription,
    stopTranscription,
  };
};

export default useAssemblyAI;