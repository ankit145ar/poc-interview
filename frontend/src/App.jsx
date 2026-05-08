import React from 'react';
import './index.scss';
import UploadPlaybackTranscriberUI from './UploadPlaybackTranscriberUI';
import TranscriberUI from './TranscriberUI';

const App = () => {
  return <>
  <UploadPlaybackTranscriberUI />
  <TranscriberUI/>
  </>;
};

export default App;

























// import React, { useEffect, useRef } from 'react';
// import useAssemblyAI from './useAssemblyAI';

// const App = () => {
//   const {
//     isRecording,
//     isLoading,
//     isConnected,
//     transcripts,
//     questions,
//     error,
//     startTranscription,
//     stopTranscription,
//   } = useAssemblyAI();

//   const transcriptEndRef = useRef(null);

//   useEffect(() => {
//     transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [transcripts]);

//   return (
//     <div style={{ padding: 20, fontFamily: 'Arial' }}>
//       <h1>AI Interview Assistant</h1>

//       {/* ✅ STATUS */}
//       <div>
//         {isLoading && <p>🟡 Connecting...</p>}
//         {isConnected && isRecording && <p>🟢 Listening...</p>}
//         {!isConnected && isRecording && !isLoading && <p>🔴 Disconnected</p>}
//         {!isRecording && <p>⚪ Idle</p>}
//       </div>

//       {/* ✅ BUTTON */}
//       <button onClick={isRecording ? stopTranscription : startTranscription}>
//         {isLoading
//           ? 'Starting...'
//           : isRecording
//           ? 'Stop Recording'
//           : 'Start Recording'}
//       </button>

//       {/* ❌ ERROR */}
//       {error && <p style={{ color: 'red' }}>❌ {error}</p>}

//       {/* 📝 TRANSCRIPTS */}
//       <div
//         style={{
//           border: '1px solid #ccc',
//           marginTop: 20,
//           padding: 10,
//           height: 250,
//           overflowY: 'auto',
//         }}
//       >
//         {transcripts.map((t) => (
//           <p key={t.id}>
//             <b>{t.speaker}:</b>
//             {/* <b>{t.role === 'interviewer' ? 'Interviewer' : 'Candidate'}:</b>  */}
//              {t.text}
//           </p>
//         ))}
//         <div ref={transcriptEndRef} />
//       </div>

//       {/* 🤖 QUESTIONS */}
//       <div style={{ marginTop: 20 }}>
//         <h3>Suggested Questions</h3>
//         {questions.length === 0 ? (
//           <p>No questions yet...</p>
//         ) : (
//           <ul>
//             {questions.map((q, i) => (
//               <li key={i}>{q}</li>
//             ))}
//           </ul>
//         )}
//       </div>
//     </div>
//   );
// };

// export default App;




// import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
// import LiveTranscription from './pages/LiveTranscription';
// import UploadAnalyzer from './pages/UploadAnalyzer';

// function App() {
//   return (
//     <BrowserRouter>
//       <div style={{ padding: 20 }}>
//         <nav style={{ marginBottom: 20 }}>
//           <Link to="/" style={{ marginRight: 10 }}>
//             Live Transcription
//           </Link>
//           <Link to="/upload">
//             Upload Analyzer
//           </Link>
//         </nav>

//         <Routes>
//           <Route path="/" element={<LiveTranscription />} />
//           <Route path="/upload" element={<UploadAnalyzer />} />
//         </Routes>
//       </div>
//     </BrowserRouter>
//   );
// }

// export default App;