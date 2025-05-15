document.addEventListener('DOMContentLoaded', function() {
    // DOM 요소들을 가져옵니다
    const passageText = document.getElementById('passage-text');
    const questionsContainer = document.getElementById('questions');
    const newPassageButton = document.getElementById('new-passage');
    const topicInput = document.getElementById('topic-input');
    const spinner = newPassageButton.querySelector('.spinner');
    
    // API 키 설정
    let GEMINI_API_KEY = localStorage.getItem('gemini_api_key') || '';
    
    // 날짜 입력란에 오늘 날짜를 자동으로 입력합니다
    document.getElementById('date').value = new Date().toLocaleDateString('ko-KR');
    
    // API 키 설정 UI 추가
    const apiKeyContainer = document.createElement('div');
    apiKeyContainer.className = 'api-key-container';
    apiKeyContainer.innerHTML = `
        <div class="info-item">
            <label for="api-key">Gemini API Key:</label>
            <input type="password" id="api-key" value="${GEMINI_API_KEY}">
            <button id="save-api-key">저장</button>
        </div>
    `;
    document.querySelector('.button-container').appendChild(apiKeyContainer);
    
    // API 키 저장 버튼 이벤트
    document.getElementById('save-api-key').addEventListener('click', function() {
        const apiKey = document.getElementById('api-key').value;
        GEMINI_API_KEY = apiKey;
        localStorage.setItem('gemini_api_key', apiKey);
        alert('API 키가 저장되었습니다.');
    });

    // Gemini API를 사용하여 지문과 문제를 생성하는 함수
    async function generatePassageWithGemini() {
        if (!GEMINI_API_KEY) {
            alert('Gemini API 키를 먼저 설정해주세요.');
            return;
        }

        // 로딩 상태 시작
        newPassageButton.classList.add('loading');
        newPassageButton.disabled = true;

        try {
            const topic = topicInput.value.trim();
            const topicPrompt = topic ? `주제: ${topic}\n` : '';

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{
                            text: `${topicPrompt}다음 요구사항에 맞는 비문학 지문과 문제를 생성해주세요:
                            1. 초등학생 수준의 교과서에 나올 수 있는 비문학 지문을 작성해주세요.
                            2. 지문은 3~5개의 문단으로 구성되어야 합니다.
                            3. 각 문단은 명확한 중심문장과 뒷받침 문장들로 구성해주세요.
                            4. 지문의 전체 길이는 1200자 내외여야 합니다.
                            5. 다음 형식으로 출력해주세요:
                            {
                                "title": "제목",
                                "content": "지문 내용",
                                "paragraphs": [
                                    {
                                        "mainSentence": "첫 번째 문단의 중심문장",
                                        "content": "첫 번째 문단 전체 내용"
                                    },
                                    {
                                        "mainSentence": "두 번째 문단의 중심문장",
                                        "content": "두 번째 문단 전체 내용"
                                    }
                                    // 문단 수에 따라 추가
                                ],
                                "questions": [
                                    {
                                        "type": "사실확인",
                                        "question": "1. 다음 중 이 글의 내용과 일치하지 않는 것은?",
                                        "options": [
                                            "첫 번째 선택지",
                                            "두 번째 선택지",
                                            "세 번째 선택지",
                                            "네 번째 선택지"
                                        ],
                                        "wrongOptionIndex": 0,
                                        "explanation": "이 선택지가 틀린 이유와 나머지 선택지들이 맞는 이유를 상세히 설명"
                                    },
                                    {
                                        "type": "글의이해",
                                        "question": "2. 이 글의 중심 내용으로 가장 적절한 것은?",
                                        "options": [
                                            "첫 번째 선택지",
                                            "두 번째 선택지",
                                            "세 번째 선택지",
                                            "네 번째 선택지"
                                        ],
                                        "correctOptionIndex": 0,
                                        "explanation": "이 선택지가 정답인 이유와 다른 선택지들이 적절하지 않은 이유를 상세히 설명"
                                    }
                                ]
                            }`
                        }]
                    }]
                })
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message);
            }

            const generatedText = data.candidates[0].content.parts[0].text;
            // JSON 형식 문자열 찾기
            const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('생성된 응답에서 JSON 형식을 찾을 수 없습니다.');
            }

            const generatedContent = JSON.parse(jsonMatch[0]);
            
            // wrongOptionIndex가 없으면 랜덤하게 생성
            if (!generatedContent.questions[0].wrongOptionIndex) {
                generatedContent.questions[0].wrongOptionIndex = Math.floor(Math.random() * 4);
            }

            // 마크다운 구분자 제거 후 문단별 중심문장 문제 추가
            generatedContent.content = generatedContent.content.replace(/\*\*/g, '');
            generatedContent.content = generatedContent.content.replace(/\*/g, '');
            generatedContent.content = generatedContent.content.replace(/\_\_/g, '');
            generatedContent.content = generatedContent.content.replace(/\_/g, '');

            // 문단 수에 따라 중심문장 문제 추가
            const paragraphs = generatedContent.content.split('\n').filter(p => p.trim());
            for (let i = 0; i < paragraphs.length; i++) {
                generatedContent.questions.push({
                    "type": "중심문장",
                    "paragraph": i + 1,
                    "question": `${generatedContent.questions.length + 1}. ${i + 1}번째 문단의 중심 내용을 찾아 한 문장으로 쓰시오.`,
                    "explanation": `이 문단의 중심 내용은 '${generatedContent.paragraphs[i].mainSentence}'입니다. 
                    이는 문단의 핵심 주장을 담고 있으며, 나머지 문장들은 이를 구체적으로 설명하거나 뒷받침하는 예시와 근거를 제시합니다.`
                });
            }

            // 요약하기 문제 추가
            generatedContent.questions.push({
                "type": "요약",
                "question": `${generatedContent.questions.length + 1}. 이 글의 내용을 다음과 같이 요약해보세요.\n1) 글의 중심 내용을 한 문장으로\n2) 각 문단의 핵심 내용을 순서대로`,
                "explanation": `요약 작성 방법:
                1. 글의 중심 내용 파악하기
                   - 제목과 각 문단의 중심문장을 연결하여 글 전체의 핵심 내용을 파악합니다.
                   - 글쓴이가 가장 강조하고자 하는 내용이 무엇인지 생각해봅니다.
                
                2. 각 문단의 핵심 내용 정리하기
                   - 각 문단의 중심문장과 뒷받침 문장들을 바탕으로 간략하게 정리합니다.
                   - 문단의 순서를 고려하여 글의 전개 과정이 드러나도록 작성합니다.`
            });
            
            displayPassage(generatedContent);
        } catch (error) {
            console.error('Error:', error);
            alert('지문 생성 중 오류가 발생했습니다: ' + error.message);
        } finally {
            // 로딩 상태 종료
            newPassageButton.classList.remove('loading');
            newPassageButton.disabled = false;
        }
    }
    
    // 지문과 문제를 화면에 표시하는 함수
    function displayPassage(passage) {
        // 지문 표시
        passageText.innerHTML = `<h4>${passage.title}</h4>
            ${passage.paragraphs.map(para => `<p>${para.content.trim()}</p>`).join('')}`;
        
        // 문제 표시
        let questionsHTML = '';
        let answersHTML = `
            <div class="answer-page">
                <h3>정답 및 해설</h3>
                <div class="answer-key">`;
        
        passage.questions.forEach((question, index) => {
            if (question.type === "사실확인" || question.type === "글의이해") {
                const isFactCheck = question.type === "사실확인";
                const answerIndex = isFactCheck ? question.wrongOptionIndex : question.correctOptionIndex;
                questionsHTML += `
                    <div class="question">
                        <h4>${question.question}</h4>
                        ${question.options.map((option, optionIndex) => `
                            <div class="option">
                                <label>
                                    ${['①', '②', '③', '④'][optionIndex]} ${option}
                                </label>
                            </div>
                        `).join('')}
                    </div>`;
                
                answersHTML += `
                    <div class="answer-item">
                        <div class="answer-number">${index + 1}번</div>
                        <div class="answer-content">
                            <div class="answer">정답: ${['①', '②', '③', '④'][answerIndex]}</div>
                            <div class="explanation">
                                <p>해설:</p>
                                <p>${question.explanation}</p>
                            </div>
                        </div>
                    </div>`;
            } else if (question.type === "중심문장") {
                questionsHTML += `
                    <div class="question">
                        <h4>${question.question}</h4>
                        <div class="answer-space"></div>
                    </div>`;
                
                answersHTML += `
                    <div class="answer-item">
                        <div class="answer-number">${index + 1}번</div>
                        <div class="answer-content">
                            <div class="answer">정답 예시: ${passage.paragraphs[question.paragraph - 1].mainSentence}</div>
                            <div class="explanation">
                                <p>해설:</p>
                                <p>${question.explanation}</p>
                            </div>
                        </div>
                    </div>`;
            } else if (question.type === "요약") {
                questionsHTML += `
                    <div class="question">
                        <h4>${question.question}</h4>
                        <div class="answer-space large"></div>
                        <div class="answer-space large"></div>
                    </div>`;
                
                answersHTML += `
                    <div class="answer-item">
                        <div class="answer-number">${index + 1}번</div>
                        <div class="answer-content">
                            <div class="answer">답안 작성 방법</div>
                            <div class="explanation">
                                <p>해설:</p>
                                <p>${question.explanation}</p>
                            </div>
                        </div>
                    </div>`;
            }
        });
        
        answersHTML += '</div></div>';
        
        // 문제 페이지와 정답 페이지를 구분하여 표시
        questionsContainer.innerHTML = questionsHTML + 
            '<div class="page-break"></div>' + // 페이지 나누기 추가
            answersHTML;
    }
    
    // 엔터 키로도 지문 생성 가능하도록 설정
    topicInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !newPassageButton.disabled) {
            generatePassageWithGemini();
        }
    });
    
    // 새로운 지문 생성 버튼 이벤트 리스너
    newPassageButton.addEventListener('click', generatePassageWithGemini);
    
    // 인쇄 버튼 이벤트 리스너
    document.getElementById('print-sheet').addEventListener('click', function() {
        window.print();
    });
}); 
