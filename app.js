/* ===== LectureLens — app.js (No API Key Required) ===== */
(() => {
    'use strict';

    // ──────────────────────────────
    // STATE
    // ──────────────────────────────
    let finalTranscript = '';
    let interimTranscript = '';
    let recognition = null;
    let isRecording = false;
    let currentOutputMode = 'notes';
    let generatedContent = '';
    let uploadedFile = null;

    // ──────────────────────────────
    // DOM REFS
    // ──────────────────────────────
    const $ = id => document.getElementById(id);

    const tabMic = $('tabMic');
    const tabFile = $('tabFile');
    const tabContentMic = $('tabContentMic');
    const tabContentFile = $('tabContentFile');

    const startBtn = $('startBtn');
    const stopBtn = $('stopBtn');
    const waveform = $('waveform');
    const waveformStatus = $('waveformStatus');

    const dropZone = $('dropZone');
    const fileInput = $('fileInput');
    const fileInfo = $('fileInfo');
    const fileNameEl = $('fileName');
    const removeFile = $('removeFile');
    const audioPlayer = $('audioPlayer');
    const autoTranscribeStatus = $('autoTranscribeStatus');
    const autoTranscribeText = $('autoTranscribeText');

    const transcriptBox = $('transcriptBox');
    const clearTranscript = $('clearTranscript');
    const copyTranscript = $('copyTranscript');
    const wordCount = $('wordCount');

    const outTabNotes = $('outTabNotes');
    const outTabQuiz = $('outTabQuiz');
    const outTabFlash = $('outTabFlash');

    const generateBtn = $('generateBtn');
    const generateBtnText = $('generateBtnText');
    const outputContent = $('outputContent');
    const generatingOverlay = $('generatingOverlay');

    const copyOutput = $('copyOutput');
    const downloadOutput = $('downloadOutput');
    const toast = $('toast');

    // Hide settings button since no API key needed
    const settingsBtn = $('settingsBtn');
    if (settingsBtn) settingsBtn.style.display = 'none';

    // ──────────────────────────────
    // TOAST
    // ──────────────────────────────
    let toastTimer;
    function showToast(msg, type = '') {
        clearTimeout(toastTimer);
        toast.textContent = msg;
        toast.className = `toast show ${type}`;
        toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    // ──────────────────────────────
    // INPUT MODE TABS
    // ──────────────────────────────
    function switchInputTab(mode) {
        if (mode === 'mic') {
            tabMic.classList.add('active'); tabFile.classList.remove('active');
            tabContentMic.classList.remove('hidden'); tabContentFile.classList.add('hidden');
        } else {
            tabFile.classList.add('active'); tabMic.classList.remove('active');
            tabContentFile.classList.remove('hidden'); tabContentMic.classList.add('hidden');
        }
    }
    tabMic.addEventListener('click', () => switchInputTab('mic'));
    tabFile.addEventListener('click', () => switchInputTab('file'));

    // ──────────────────────────────
    // OUTPUT MODE TABS
    // ──────────────────────────────
    function switchOutputTab(mode) {
        currentOutputMode = mode;
        [outTabNotes, outTabQuiz, outTabFlash].forEach(t => t.classList.remove('active'));
        if (mode === 'notes') outTabNotes.classList.add('active');
        if (mode === 'quiz') outTabQuiz.classList.add('active');
        if (mode === 'flashcards') outTabFlash.classList.add('active');
        const labels = { notes: 'Generate Study Notes', quiz: 'Generate Quiz', flashcards: 'Generate Flashcards' };
        generateBtnText.textContent = labels[mode];
    }
    outTabNotes.addEventListener('click', () => switchOutputTab('notes'));
    outTabQuiz.addEventListener('click', () => switchOutputTab('quiz'));
    outTabFlash.addEventListener('click', () => switchOutputTab('flashcards'));

    // ──────────────────────────────
    // TRANSCRIPT UTILITIES
    // ──────────────────────────────
    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderTranscript() {
        if (!finalTranscript && !interimTranscript) {
            transcriptBox.innerHTML = '<p class="placeholder-text">Your lecture transcript will appear here as you speak or after uploading a file…</p>';
        } else {
            transcriptBox.innerHTML =
                `<span class="final-text">${escapeHtml(finalTranscript)}</span>` +
                (interimTranscript ? `<span class="interim-text"> ${escapeHtml(interimTranscript)}</span>` : '');
        }
        const words = (finalTranscript + ' ' + interimTranscript).trim().split(/\s+/).filter(Boolean).length;
        wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
        transcriptBox.scrollTop = transcriptBox.scrollHeight;
    }

    clearTranscript.addEventListener('click', () => {
        finalTranscript = ''; interimTranscript = '';
        renderTranscript(); showToast('Transcript cleared');
    });

    copyTranscript.addEventListener('click', () => {
        const text = (finalTranscript + ' ' + interimTranscript).trim();
        if (!text) { showToast('Nothing to copy', 'error'); return; }
        navigator.clipboard.writeText(text).then(() => showToast('Transcript copied ✓', 'success'));
    });

    // ──────────────────────────────
    // SPEECH RECOGNITION — LIVE MIC
    // ──────────────────────────────
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    function startRecording() {
        if (!SpeechRecognition) { showToast('Speech API not supported. Use Chrome or Edge.', 'error'); return; }
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRecording = true;
            startBtn.disabled = true; stopBtn.disabled = false;
            startBtn.classList.add('recording');
            waveform.classList.add('recording');
            waveformStatus.textContent = 'Recording…';
            waveformStatus.classList.add('recording');
        };

        recognition.onresult = e => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript;
                if (e.results[i].isFinal) finalTranscript += t + ' ';
                else interim += t;
            }
            interimTranscript = interim;
            renderTranscript();
        };

        recognition.onerror = e => {
            const msgs = {
                'no-speech': 'No speech detected. Try speaking closer to the mic.',
                'audio-capture': 'Microphone not found or access denied.',
                'not-allowed': 'Microphone access denied. Please allow it in browser settings.',
                'network': 'Network error during recognition.',
            };
            showToast(msgs[e.error] || `Error: ${e.error}`, 'error');
            stopRecording();
        };

        recognition.onend = () => { if (isRecording) recognition.start(); };
        recognition.start();
    }

    function stopRecording() {
        isRecording = false;
        if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
        startBtn.disabled = false; stopBtn.disabled = true;
        startBtn.classList.remove('recording');
        waveform.classList.remove('recording');
        waveformStatus.textContent = finalTranscript ? 'Recording stopped.' : 'Ready to record';
        waveformStatus.classList.remove('recording');
        interimTranscript = '';
        renderTranscript();
    }

    startBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);

    // ──────────────────────────────
    // FILE UPLOAD
    // ──────────────────────────────
    let fileRecognition = null;

    function stopFileTranscription() {
        if (fileRecognition) {
            try { fileRecognition.onend = null; fileRecognition.stop(); } catch (e) { }
            fileRecognition = null;
        }
        audioPlayer.pause();
        autoTranscribeStatus.classList.add('hidden');
    }

    function startAutoTranscribe(file) {
        if (!SpeechRecognition) {
            showToast('Speech API not supported in this browser. Use Chrome or Edge.', 'error'); return;
        }
        // Reset transcript
        finalTranscript = ''; interimTranscript = ''; renderTranscript();

        autoTranscribeText.textContent = 'Transcribing…';
        autoTranscribeStatus.classList.remove('hidden');

        fileRecognition = new SpeechRecognition();
        fileRecognition.continuous = true;
        fileRecognition.interimResults = true;
        fileRecognition.lang = 'en-US';

        fileRecognition.onresult = e => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript;
                if (e.results[i].isFinal) finalTranscript += t + ' ';
                else interim += t;
            }
            interimTranscript = interim; renderTranscript();
        };

        const cleanup = () => {
            audioPlayer.pause();
            autoTranscribeStatus.classList.add('hidden');
            interimTranscript = ''; renderTranscript();
            showToast('Transcription complete ✓', 'success');
            fileRecognition = null;
        };

        fileRecognition.onerror = e => { showToast(`Transcription error: ${e.error}`, 'error'); cleanup(); };
        audioPlayer.onended = () => { if (fileRecognition) { fileRecognition.stop(); } };
        fileRecognition.onend = cleanup;

        // Start playing and recognising simultaneously
        audioPlayer.play().catch(() => { });
        fileRecognition.start();
    }

    function handleFile(file) {
        const isAudio = file && file.type.startsWith('audio/');
        const isVideo = file && file.type === 'video/mp4';
        if (!isAudio && !isVideo) { showToast('Please upload a valid audio or MP4 file', 'error'); return; }

        // Stop any previous transcription
        stopFileTranscription();

        uploadedFile = file;
        fileNameEl.textContent = file.name;
        fileInfo.classList.remove('hidden');
        dropZone.classList.add('hidden');
        audioPlayer.src = URL.createObjectURL(file);
        audioPlayer.classList.remove('hidden');

        // Auto-start transcription immediately
        startAutoTranscribe(file);
    }

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });

    removeFile.addEventListener('click', () => {
        stopFileTranscription();
        uploadedFile = null; fileInput.value = ''; audioPlayer.src = '';
        fileInfo.classList.add('hidden'); audioPlayer.classList.add('hidden');
        dropZone.classList.remove('hidden');
        finalTranscript = ''; interimTranscript = ''; renderTranscript();
    });

    // Auto-transcription is triggered in handleFile — no manual button needed

    // ══════════════════════════════════════════════════
    //  BROWSER-SIDE AI ENGINE  (No API Key Required)
    // ══════════════════════════════════════════════════

    // ── Stop words for TF-IDF keyword extraction ──
    const STOP_WORDS = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
        'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need',
        'this', 'that', 'these', 'those', 'it', 'its', 'we', 'our', 'us', 'you', 'your',
        'he', 'she', 'they', 'their', 'them', 'i', 'me', 'my', 'what', 'which', 'who',
        'when', 'where', 'how', 'why', 'not', 'no', 'so', 'if', 'then', 'than', 'as', 'up',
        'about', 'after', 'before', 'by', 'from', 'into', 'through', 'during', 'also',
        'just', 'very', 'now', 'here', 'there', 'some', 'any', 'all', 'both', 'each', 'more',
        'most', 'other', 'such', 'even', 'own', 'same', 'both', 'few', 'more', 'most', 'other',
        'only', 'same', 'such', 'than', 'too', 'very', 's', 't', 'able', 'because', 'come',
        'each', 'him', 'how', 'its', 'like', 'make', 'many', 'over', 'say', 'see', 'thing'
    ]);

    // ── Sentence tokenizer ──
    function tokenizeSentences(text) {
        return text
            .replace(/([.!?])\s+/g, '$1|')
            .split('|')
            .map(s => s.trim())
            .filter(s => s.split(/\s+/).length >= 5);
    }

    // ── Word tokenizer ──
    function tokenizeWords(text) {
        return text.toLowerCase().match(/\b[a-z][a-z']{2,}\b/g) || [];
    }

    // ── TF-IDF keyword extraction ──
    function extractKeywords(text, topN = 12) {
        const sentences = tokenizeSentences(text);
        const words = tokenizeWords(text).filter(w => !STOP_WORDS.has(w));

        // Term frequency
        const tf = {};
        words.forEach(w => { tf[w] = (tf[w] || 0) + 1; });

        // IDF (inverse doc frequency across sentences)
        const idf = {};
        const wordSet = Object.keys(tf);
        wordSet.forEach(w => {
            const df = sentences.filter(s => s.toLowerCase().includes(w)).length;
            idf[w] = Math.log((sentences.length + 1) / (df + 1)) + 1;
        });

        // Score = tf * idf, prefer longer words
        const scored = wordSet
            .filter(w => !STOP_WORDS.has(w))
            .map(w => ({ word: w, score: tf[w] * idf[w] * (w.length > 6 ? 1.3 : 1) }))
            .sort((a, b) => b.score - a.score);

        return scored.slice(0, topN).map(x => x.word);
    }

    // ── Sentence scoring for extractive summarization ──
    function scoreSentences(text) {
        const sentences = tokenizeSentences(text);
        const keywords = new Set(extractKeywords(text, 20));

        return sentences.map((sent, idx) => {
            const words = tokenizeWords(sent);
            const kwHits = words.filter(w => keywords.has(w)).length;
            const posScore = idx === 0 ? 1.5 : idx < 3 ? 1.2 : 1.0; // first sentences weighted higher
            const lenPenalty = sent.split(/\s+/).length < 8 ? 0.7 : 1.0;
            const score = (kwHits / Math.max(words.length, 1)) * posScore * lenPenalty;
            return { sent, score, idx };
        });
    }

    // ── Top sentences ──
    function topSentences(text, n) {
        return scoreSentences(text)
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, n)
            .sort((a, b) => a.idx - b.idx) // restore reading order
            .map(s => s.sent);
    }

    // ── Group vocabulary: capitalize keyword nicely ──
    function prettify(word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }

    // ── Find sentences that define or explain a concept ──
    function findDefiningSentence(text, term) {
        const sentences = tokenizeSentences(text);
        const lower = term.toLowerCase();
        // Look for "X is", "X are", "X refers to", "X means", definition-style sentences
        const defPatterns = [/ is /, / are /, / refers to /, / means /, / defined as /, / can be /, / involves /, / consists /];
        const candidates = sentences.filter(s => {
            const sl = s.toLowerCase();
            return sl.includes(lower) && defPatterns.some(p => p.test(sl));
        });
        if (candidates.length) return candidates[0];
        // Fallback: any sentence with the term
        return sentences.find(s => s.toLowerCase().includes(lower)) || '';
    }

    // ══════════════════════════════════════════════════
    //  NOTES GENERATOR
    // ══════════════════════════════════════════════════
    function generateNotes(transcript) {
        const sentences = tokenizeSentences(transcript);
        const keywords = extractKeywords(transcript, 12);
        const allWords = tokenizeWords(transcript).filter(w => !STOP_WORDS.has(w));

        // Summary: top 3 sentences
        const summaryLines = topSentences(transcript, 3);

        // Detect topic groups: cluster consecutive sentences sharing keywords
        const scored = scoreSentences(transcript);
        const detailedBullets = topSentences(transcript, Math.min(12, Math.ceil(sentences.length * 0.4)));

        // Key topics: chunk sentences into groups of ≈4 and pick theme keyword
        const chunkSize = Math.max(4, Math.floor(sentences.length / 5));
        const topics = [];
        for (let i = 0; i < sentences.length; i += chunkSize) {
            const chunk = sentences.slice(i, i + chunkSize).join(' ');
            const kw = extractKeywords(chunk, 1);
            if (kw.length) topics.push(prettify(kw[0]));
        }
        const uniqueTopics = [...new Set(topics)].slice(0, 6);

        // Takeaways: very high-scored sentences not already in summary
        const summarySet = new Set(summaryLines);
        const takeaways = scored
            .filter(s => !summarySet.has(s.sent) && s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)
            .sort((a, b) => a.idx - b.idx)
            .map(s => s.sent);

        // Build export text
        generatedContent = [
            '=== SUMMARY ===',
            summaryLines.join(' '),
            '',
            '=== KEY TOPICS ===',
            uniqueTopics.map(t => '• ' + t).join('\n'),
            '',
            '=== DETAILED NOTES ===',
            detailedBullets.map(b => '• ' + b).join('\n'),
            '',
            '=== KEY TERMS ===',
            keywords.map(prettify).join(', '),
            '',
            '=== TAKEAWAYS ===',
            takeaways.map(t => '• ' + t).join('\n'),
        ].join('\n');

        // Build HTML
        let html = '<div class="notes-body">';

        // Summary
        html += `<div class="notes-section"><h3>📋 Summary</h3><p>${escapeHtml(summaryLines.join(' '))}</p></div>`;

        // Key Topics
        if (uniqueTopics.length) {
            html += `<div class="notes-section"><h3>🗂️ Key Topics</h3><ul>` +
                uniqueTopics.map(t => `<li>${escapeHtml(t)}</li>`).join('') +
                `</ul></div>`;
        }

        // Detailed Notes
        if (detailedBullets.length) {
            html += `<div class="notes-section"><h3>📝 Detailed Notes</h3><ul>` +
                detailedBullets.map(b => `<li>${escapeHtml(b)}</li>`).join('') +
                `</ul></div>`;
        }

        // Key Terms
        html += `<div class="notes-section"><h3>🔑 Key Terms</h3><div class="key-terms-grid">` +
            keywords.map(k => `<span class="key-term-chip">${escapeHtml(prettify(k))}</span>`).join('') +
            `</div></div>`;

        // Takeaways
        if (takeaways.length) {
            html += `<div class="notes-section"><h3>🎯 Key Takeaways</h3><ul>` +
                takeaways.map(t => `<li>${escapeHtml(t)}</li>`).join('') +
                `</ul></div>`;
        }

        html += '</div>';
        return html;
    }

    // ══════════════════════════════════════════════════
    //  QUIZ GENERATOR
    // ══════════════════════════════════════════════════
    function generateQuiz(transcript) {
        const sentences = tokenizeSentences(transcript);
        const scored = scoreSentences(transcript)
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score);

        const quizItems = [];
        const used = new Set();

        // Strategy 1: "What is X?" — sentences containing definition patterns
        const defPatterns = [/ is /, / are /, / refers to /, / means /, / defined as /, / called /];
        for (const { sent } of scored) {
            if (quizItems.length >= 8) break;
            if (used.has(sent)) continue;
            const sl = sent.toLowerCase();
            for (const p of defPatterns) {
                if (p.test(sl)) {
                    // Convert "X is Y" → "What is X?" / Answer: "Y"
                    const match = sent.match(/^(.+?)\s+(?:is|are|means|refers to|is called)\s+(.+)$/i);
                    if (match) {
                        quizItems.push({ q: `What is ${match[1].trim()}?`, a: match[2].trim() });
                        used.add(sent); break;
                    }
                }
            }
        }

        // Strategy 2: Factual sentences → "What does the lecture say about [keyword]?"
        for (const { sent } of scored) {
            if (quizItems.length >= 8) break;
            if (used.has(sent)) continue;
            const kws = tokenizeWords(sent).filter(w => !STOP_WORDS.has(w));
            if (kws.length < 2) continue;
            const kw = kws[0];
            quizItems.push({
                q: `According to the lecture, what is explained about "${prettify(kw)}"?`,
                a: sent
            });
            used.add(sent);
        }

        // Strategy 3: Fill-in-the-blank from important sentences
        for (const { sent } of scored) {
            if (quizItems.length >= 8) break;
            if (used.has(sent)) continue;
            const kws = tokenizeWords(sent).filter(w => !STOP_WORDS.has(w) && w.length > 5);
            if (!kws.length) continue;
            const blankWord = kws[Math.min(1, kws.length - 1)];
            const blanked = sent.replace(new RegExp(`\\b${blankWord}\\b`, 'i'), '______');
            if (blanked !== sent) {
                quizItems.push({ q: `Complete the sentence: "${blanked}"`, a: `"${prettify(blankWord)}" — Full sentence: ${sent}` });
                used.add(sent);
            }
        }

        // Pad with remaining high-scored sentences
        for (const { sent } of scored) {
            if (quizItems.length >= 8) break;
            if (used.has(sent)) continue;
            quizItems.push({ q: `What does the following statement mean in the context of this lecture?`, a: sent });
            used.add(sent);
        }

        generatedContent = quizItems.map((q, i) => `Q${i + 1}: ${q.q}\nA: ${q.a}`).join('\n\n');

        let html = '<div class="quiz-body">';
        quizItems.forEach((item, i) => {
            html += `
        <div class="quiz-item">
          <div class="quiz-question">
            <span class="quiz-num">${i + 1}</span>
            <span class="quiz-q-text">${escapeHtml(item.q)}</span>
            <span class="quiz-toggle">▼</span>
          </div>
          <div class="quiz-answer">
            <div class="answer-label">Answer</div>
            ${escapeHtml(item.a)}
          </div>
        </div>`;
        });
        html += '</div>';
        return html;
    }

    // ══════════════════════════════════════════════════
    //  FLASHCARD GENERATOR
    // ══════════════════════════════════════════════════
    function generateFlashcards(transcript) {
        const keywords = extractKeywords(transcript, 15);
        const pairs = [];

        for (const kw of keywords) {
            if (pairs.length >= 12) break;
            const def = findDefiningSentence(transcript, kw);
            if (def && def.length > 15) {
                // Shorten definition to fit card
                const short = def.length > 120 ? def.slice(0, 117) + '…' : def;
                pairs.push({ term: prettify(kw), def: short });
            }
        }

        // Fallback: use important sentences as "concept → explanation"
        if (pairs.length < 5) {
            const extras = topSentences(transcript, 10);
            for (const sent of extras) {
                if (pairs.length >= 12) break;
                const kws = tokenizeWords(sent).filter(w => !STOP_WORDS.has(w) && w.length > 4);
                if (!kws.length) continue;
                const term = prettify(kws[0]);
                if (!pairs.find(p => p.term === term)) {
                    pairs.push({ term, def: sent.length > 120 ? sent.slice(0, 117) + '…' : sent });
                }
            }
        }

        generatedContent = pairs.map(p => `TERM: ${p.term}\nDEF: ${p.def}`).join('\n\n');

        if (!pairs.length) {
            return '<div class="output-placeholder"><div class="placeholder-art">🃏</div><p>Not enough content for flashcards. Try recording a longer lecture.</p></div>';
        }

        let html = '<div class="flashcards-grid">';
        for (const p of pairs) {
            html += `
        <div class="flashcard-wrapper">
          <div class="flashcard">
            <div class="flashcard-front">
              <div class="flashcard-side-label">Term</div>
              <div class="flashcard-term">${escapeHtml(p.term)}</div>
            </div>
            <div class="flashcard-back">
              <div class="flashcard-side-label">Definition</div>
              <div class="flashcard-def">${escapeHtml(p.def)}</div>
            </div>
          </div>
        </div>`;
        }
        html += '</div><p class="flashcards-hint">👆 Click any card to flip it</p>';
        return html;
    }

    // ──────────────────────────────
    // GENERATE (orchestrator)
    // ──────────────────────────────
    generateBtn.addEventListener('click', () => {
        const transcript = (finalTranscript + ' ' + interimTranscript).trim();
        if (!transcript || transcript.split(/\s+/).length < 20) {
            showToast('Please record more content first (at least a few sentences)', 'error'); return;
        }

        generateBtn.disabled = true;
        generatingOverlay.classList.remove('hidden');
        copyOutput.disabled = true;
        downloadOutput.disabled = true;

        const modeLabels = { notes: 'study notes', quiz: 'quiz', flashcards: 'flashcards' };
        document.querySelector('.generating-text').textContent = `Generating ${modeLabels[currentOutputMode]}…`;

        // Use setTimeout to let the UI update before heavy processing
        setTimeout(() => {
            try {
                let html;
                if (currentOutputMode === 'notes') html = generateNotes(transcript);
                else if (currentOutputMode === 'quiz') html = generateQuiz(transcript);
                else html = generateFlashcards(transcript);

                outputContent.innerHTML = html;

                if (currentOutputMode === 'quiz') {
                    outputContent.querySelectorAll('.quiz-question').forEach(el => {
                        el.addEventListener('click', () => el.closest('.quiz-item').classList.toggle('revealed'));
                    });
                }
                if (currentOutputMode === 'flashcards') {
                    outputContent.querySelectorAll('.flashcard-wrapper').forEach(c => {
                        c.addEventListener('click', () => c.classList.toggle('flipped'));
                    });
                }

                copyOutput.disabled = false;
                downloadOutput.disabled = false;
                const label = modeLabels[currentOutputMode];
                showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} generated ✓`, 'success');
            } catch (err) {
                showToast('Error generating content. Please try again.', 'error');
                outputContent.innerHTML = `<div class="output-placeholder"><div class="placeholder-art">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
            } finally {
                generateBtn.disabled = false;
                generatingOverlay.classList.add('hidden');
            }
        }, 300);
    });

    // ──────────────────────────────
    // EXPORT
    // ──────────────────────────────
    copyOutput.addEventListener('click', () => {
        if (!generatedContent) return;
        navigator.clipboard.writeText(generatedContent).then(() => showToast('Copied to clipboard ✓', 'success'));
    });

    downloadOutput.addEventListener('click', () => {
        if (!generatedContent) return;
        const labels = { notes: 'StudyNotes', quiz: 'Quiz', flashcards: 'Flashcards' };
        const blob = new Blob([generatedContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `Lecturemate_${labels[currentOutputMode]}_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click(); URL.revokeObjectURL(url);
        showToast('Downloaded ✓', 'success');
    });

    // ──────────────────────────────
    // INIT
    // ──────────────────────────────
    switchOutputTab('notes');
    renderTranscript();

})();
