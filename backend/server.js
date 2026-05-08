const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { AssemblyAI } = require('assemblyai');
const OpenAI = require('openai');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get('/token', async (req, res) => {
  try {
    const token = await client.streaming.createTemporaryToken({ expires_in_seconds: 600 });
    res.json({ token });
  } catch (error) {
    console.error('Error generating token:', error);
    console.log(error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

app.post('/generate-questions', async (req, res) => {
  try {
    const conversation = Array.isArray(req.body.conversation) ? req.body.conversation : null;
    const transcriptInput = req.body.transcribe || req.body.transcript || '';

    let promptInput = transcriptInput;
    if (conversation && conversation.length) {
      const formattedConversation = conversation
        .filter((item) => item && typeof item.text === 'string')
        .slice(-10)
        .map((item) => `${item.role || 'speaker'}: ${item.text}`)
        .join('\n');

      if (formattedConversation) {
        promptInput = formattedConversation;
      }
    }

    if (!promptInput || !promptInput.trim()) {
      return res.status(400).json({ error: 'Transcript or conversation text is required' });
    }

    const prompt = `You are an AI assistant that generates interview questions based on the provided text. Create exactly 5 short, varied, relevant questions that follow from this text. Do not repeat previous questions.\n\nContext:\n${promptInput}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an AI assistant that generates follow-up interview questions.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 300,
    });

    const text = response.choices?.[0]?.message?.content || '';
    const questions = text
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[\.).\s-]*/, '').trim())
      .filter(Boolean)
      .slice(0, 5);

    res.json({ questions });
  } catch (error) {
    console.error('Error generating questions:', error);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const filePath = req.file.path;
    const uploadResponse = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      fs.createReadStream(filePath),
      {
        headers: {
          authorization: process.env.ASSEMBLYAI_API_KEY,
          'transfer-encoding': 'chunked',
        },
      }
    );

    const audioUrl = uploadResponse.data.upload_url;

    let transcript = await client.transcripts.transcribe({
      audio: audioUrl,
      speaker_labels: false,
      speech_models: ["universal-3-pro"],
    });

    if (transcript.status !== 'completed' && transcript.id) {
      while (transcript.status !== 'completed' && transcript.status !== 'error') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        transcript = await client.transcripts.get(transcript.id);
      }
    }

    if (transcript.status === 'error') {
      throw new Error(transcript.error || 'Transcription failed');
    }

    const fullText = transcript.text || '';
    const transcriptLines = fullText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    res.json({ audioUrl, fullText, transcriptLines });
  } catch (error) {
    console.error('Upload audio transcription failed:', error);
    res.status(500).json({ error: error.message || 'Audio transcription failed' });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});















// const express = require('express');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const { AssemblyAI } = require('assemblyai');
// const OpenAI = require('openai');

// dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json());

// // AssemblyAI client
// const client = new AssemblyAI({
//   apiKey: process.env.ASSEMBLYAI_API_KEY,
// });

// // OpenAI client
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// // ✅ Token route (already working)
// app.get('/token', async (req, res) => {
//   try {
//     const token = await client.streaming.createTemporaryToken({
//       expires_in_seconds: 600,
//     });
//     res.json({ token });
//   } catch (error) {
//     console.error('Error generating token:', error);
//     res.status(500).json({ error: 'Failed to generate token' });
//   }
// });

// // ✅ NEW: Generate interview questions
// app.post('/generate-questions', async (req, res) => {
//   try {
//     const { conversation } = req.body;

//     if (!conversation || !conversation.length) {
//       return res.json({ questions: [] });
//     }

//     const formatted = conversation
//       .map((c) => `${c.role}: ${c.text}`)
//       .join('\n');

//     const prompt = `
// You are an AI interview assistant.

// Below is a conversation between an interviewer and a candidate:

// ${formatted}

// Generate 3 relevant follow-up interview questions.
// Rules:
// - Keep them short
// - Make them technical if possible
// - Do not repeat previous questions
// - Ask as an interviewer
// `;

//     const response = await openai.chat.completions.create({
//       model: 'gpt-4o-mini',
//       messages: [{ role: 'user', content: prompt }],
//     });

//     const text = response.choices[0].message.content;

//     const questions = text
//       .split('\n')
//       .map((q) => q.replace(/^\d+[\).\s]/, '').trim())
//       .filter(Boolean);

//     res.json({ questions });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to generate questions' });
//   }
// });

// app.post('/upload-audio', async (req, res) => {
//   try {
//     const { audioUrl } = req.body;

//     const transcript = await client.transcripts.transcribe({
//       audio: audioUrl,
//       speaker_labels: true,
//     });

//     res.json(transcript);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Transcription failed' });
//   }
// });

// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => {
//   console.log(`Backend server running on port ${PORT}`);
// });



// require('dotenv').config();

// const express = require('express');
// const cors = require('cors');
// const multer = require('multer');
// const axios = require('axios');
// const fs = require('fs');
// const { AssemblyAI } = require('assemblyai');

// const app = express();
// app.use(cors());
// app.use(express.json());

// // 📁 temp file storage
// const upload = multer({ dest: 'uploads/' });

// // 🔑 AssemblyAI client
// const client = new AssemblyAI({
//   apiKey: process.env.ASSEMBLYAI_API_KEY,
// });


// // =====================================================
// // ✅ 1. TOKEN API (for realtime - optional)
// // =====================================================
// app.get('/token', async (req, res) => {
//   try {
//     const token = await client.streaming.createTemporaryToken({
//       expires_in_seconds: 600,
//     });

//     res.json({ token });
//   } catch (error) {
//     console.error('Token error:', error);
//     res.status(500).json({ error: 'Failed to generate token' });
//   }
// });


// // =====================================================
// // ✅ 2. UPLOAD AUDIO + TRANSCRIBE
// // =====================================================
// app.post('/upload-audio', upload.single('audio'), async (req, res) => {
//   try {
//     const filePath = req.file.path;

//     console.log('Uploading file to AssemblyAI...');

//     // 🔹 Step 1: Upload file
//     const uploadRes = await axios.post(
//       'https://api.assemblyai.com/v2/upload',
//       fs.createReadStream(filePath),
//       {
//         headers: {
//           authorization: process.env.ASSEMBLYAI_API_KEY,
//           'transfer-encoding': 'chunked',
//         },
//       }
//     );

//     const audioUrl = uploadRes.data.upload_url;

//     console.log('File uploaded. Starting transcription...');

//     // 🔹 Step 2: Transcribe
//     const transcript = await client.transcripts.transcribe({
//       audio: audioUrl,
//       speaker_labels: true,
//     });

//     console.log('Transcription completed');

//     // 🔹 Clean temp file
//     fs.unlinkSync(filePath);

//     res.json(transcript);
//   } catch (error) {
//     console.error('Upload/Transcribe error:', error);
//     res.status(500).json({ error: 'Transcription failed' });
//   }
// });


// // =====================================================
// // ✅ 3. GENERATE QUESTIONS (simple version)
// // =====================================================
// app.post('/generate-questions', async (req, res) => {
//   try {
//     const { conversation } = req.body;

//     // 🧠 Basic logic (replace later with OpenAI if needed)
//     const lastMessage = conversation[conversation.length - 1]?.text || '';

//     const questions = [];

//     if (lastMessage.toLowerCase().includes('react')) {
//       questions.push(
//         'Can you explain React lifecycle?',
//         'What are hooks in React?',
//         'How do you optimize performance in React?'
//       );
//     } else if (lastMessage.toLowerCase().includes('node')) {
//       questions.push(
//         'What is event loop in Node.js?',
//         'How does async handling work in Node?',
//         'What are streams in Node.js?'
//       );
//     } else {
//       questions.push(
//         'Can you explain more about that?',
//         'What challenges did you face?',
//         'How did you solve that problem?'
//       );
//     }

//     res.json({ questions });
//   } catch (error) {
//     console.error('Question generation error:', error);
//     res.status(500).json({ error: 'Failed to generate questions' });
//   }
// });


// // =====================================================
// // 🚀 START SERVER
// // =====================================================
// const PORT = process.env.PORT || 3001;

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });