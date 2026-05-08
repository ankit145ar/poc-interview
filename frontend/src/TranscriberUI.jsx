import React, { useEffect, useRef, useState } from "react";
import useAssemblyAI2 from "./useAssemblyAI2";

const TranscriberUI = () => {
    const {
        isRecording,
        isLoading,
        transcripts,
        error,
        startTranscription,
        stopTranscription,
    } = useAssemblyAI2();

    const [questions, setQuestions] = useState([]);
    const transcriptsRef = useRef(transcripts);
    const timerRef = useRef(null);

    useEffect(() => {
        transcriptsRef.current = transcripts;
    }, [transcripts]);

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
        }
    };

    useEffect(() => {
        if (!isRecording) {
            clearInterval(timerRef.current);
            return;
        }

        fetchQuestions();
        timerRef.current = setInterval(fetchQuestions, 15000);

        return () => clearInterval(timerRef.current);
    }, [isRecording]);

    return (
        <div style={styles.container}>

            {/* 🔹 TOP CONTROLS */}
            <div style={styles.topBar}>
                {!isRecording ? (
                    <button
                        onClick={startTranscription}
                        disabled={isLoading}
                        style={styles.startBtn}
                    >
                        {isLoading ? "Starting..." : "Start"}
                    </button>
                ) : (
                    <button onClick={stopTranscription} style={styles.stopBtn}>
                        Stop
                    </button>
                )}
            </div>

            {/* 🔹 ERROR */}
            {error && <div style={styles.error}>{error}</div>}

            <div style={{ display: 'flex', flex: '1' }}>
                {/* 🔹 TRANSCRIPT AREA */}
                <div style={styles.transcriptBox}>
                    {transcripts.map((line, i) => (
                        <p key={i} style={styles.line}>
                            {line}
                        </p>
                    ))}
                </div>

                {/* 🔹 SUGGESTED QUESTIONS */}
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
                            Suggestions will appear here as the transcript grows.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TranscriberUI;

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
        background: "#f7fafc",
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

    transcriptBox: {
        flex: 1,
        padding: "20px",
        overflowY: "auto",
        background: "#ffffff",
    },

    questionsBox: {
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