import React from 'react';
import useUploadAssemblyAI from '../hooks/useUploadAssemblyAI';

const UploadAnalyzer = () => {
  const {
    audioUrl,
    transcript,
    currentIndex,
    questions,
    uploadAudio,
    handleTimeUpdate,
  } = useUploadAssemblyAI();

  return (
    <div>
      <h2>Upload Audio Analyzer</h2>

      <input
        type="file"
        accept="audio/*"
        onChange={(e) => uploadAudio(e.target.files[0])}
      />

      {audioUrl && (
        <audio
          controls
          src={audioUrl}
          onTimeUpdate={(e) => handleTimeUpdate(e.target.currentTime)}
          style={{ width: '100%', marginTop: 20 }}
        />
      )}

      <div style={{ marginTop: 20 }}>
        {transcript.map((t, i) => (
          <div
            key={i}
            style={{
              background: i === currentIndex ? '#d4f8d4' : 'transparent',
              padding: 5,
            }}
          >
            <b>{t.speaker}:</b> {t.text}
          </div>
        ))}
      </div>

      <h3>Questions</h3>
      {questions.map((q, i) => (
        <p key={i}>• {q}</p>
      ))}
    </div>
  );
};

export default UploadAnalyzer;