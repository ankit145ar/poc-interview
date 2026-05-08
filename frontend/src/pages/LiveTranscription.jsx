import React from 'react';
import useLiveAssemblyAI from '../hooks/useLiveAssemblyAI';

const LiveTranscription = () => {
  const {
    isRecording,
    transcripts,
    questions,
    startTranscription,
    stopTranscription,
  } = useLiveAssemblyAI();

  return (
    <div>
      <h2>Live Transcription</h2>

      <button onClick={isRecording ? stopTranscription : startTranscription}>
        {isRecording ? 'Stop' : 'Start'}
      </button>

      <div style={{ marginTop: 20 }}>
        {transcripts.map((t) => (
          <p key={t.id}>
            <b>{t.speaker}:</b> {t.text}
          </p>
        ))}
      </div>

      <h3>Questions</h3>
      {questions.map((q, i) => (
        <p key={i}>• {q}</p>
      ))}
    </div>
  );
};

export default LiveTranscription;