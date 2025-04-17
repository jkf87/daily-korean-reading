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

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-exp-03-25:generateContent?key=${GEMINI_API_KEY}`, {
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
                            2. 지문은 4개의 문단으로 구성되어야 합니다.
                            3. 각 문단은 명확한 중심문장을 포함해야 합니다.
                            4. 지문의 전체 길이는 1200자 내외여야 합니다.
                            5. 다음 형식으로 출력해주세요:
                            {
                                "title": "제목",
                                "content": "지문 내용",
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
                                        "wrongOptionIndex": 0,  // 0~3 중 랜덤하게 틀린 답을 지정
                                        "explanation": "이 선택지가 틀린 이유와 나머지 선택지들이 맞는 이유를 상세히 설명"
                                    },
                                    {
                                        "type": "중심문장",
                                        "paragraph": 1,
                                        "question": "2. 첫 번째 문단의 중심문장을 찾아 쓰시오.",
                                        "explanation": "이 문장이 중심문장인 이유와 이 문장을 중심으로 문단이 어떻게 전개되는지 설명"
                                    },
                                    {
                                        "type": "중심문장",
                                        "paragraph": 2,
                                        "question": "3. 두 번째 문단의 중심문장을 찾아 쓰시오.",
                                        "explanation": "이 문장이 중심문장인 이유와 이 문장을 중심으로 문단이 어떻게 전개되는지 설명"
                                    },
                                    {
                                        "type": "중심문장",
                                        "paragraph": 3,
                                        "question": "4. 세 번째 문단의 중심문장을 찾아 쓰시오.",
                                        "explanation": "이 문장이 중심문장인 이유와 이 문장을 중심으로 문단이 어떻게 전개되는지 설명"
                                    },
                                    {
                                        "type": "요약",
                                        "question": "5. 이 글을 요약해서 세 문장으로 쓰시오.",
                                        "explanation": "각 문단의 핵심 내용을 연결하여 전체 글의 흐름을 살리는 방법 설명"
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

            // 마크다운 구분자 제거
            generatedContent.content = generatedContent.content.replace(/\*\*/g, '');
            generatedContent.content = generatedContent.content.replace(/\*/g, '');
            generatedContent.content = generatedContent.content.replace(/\_\_/g, '');
            generatedContent.content = generatedContent.content.replace(/\_/g, '');
            
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
            ${passage.content.split('\n').map(para => `<p>${para.trim()}</p>`).join('')}`;
        
        // 문제 표시
        let questionsHTML = '';
        let answersHTML = `
            <div class="answer-page">
                <h3>정답 및 해설</h3>
                <div class="answer-key">`;
        
        passage.questions.forEach((question, index) => {
            if (question.type === "사실확인") {
                const wrongIndex = question.wrongOptionIndex || 3; // 기본값은 3(④번)
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
                            <div class="answer">정답: ${['①', '②', '③', '④'][wrongIndex]}</div>
                            <div class="explanation">
                                <p>해설:</p>
                                <p>${question.explanation || `${wrongIndex + 1}번 선택지는 지문에서 언급되지 않거나 지문의 내용과 일치하지 않는 내용입니다. 
                                나머지 선택지들은 모두 지문에서 직접적으로 언급된 내용입니다.`}</p>
                            </div>
                        </div>
                    </div>`;
            } else if (question.type === "중심문장") {
                questionsHTML += `
                    <div class="question">
                        <h4>${question.question}</h4>
                        <div class="answer-space"></div>
                    </div>`;
                
                // 중심문장 문제의 정답은 해당 문단의 중심문장
                const paragraphs = passage.content.split('\n').filter(p => p.trim()); // 빈 줄 제거
                const mainSentence = paragraphs[question.paragraph - 1].split('.')[0] + '.';
                answersHTML += `
                    <div class="answer-item">
                        <div class="answer-number">${index + 1}번</div>
                        <div class="answer-content">
                            <div class="answer">정답: ${mainSentence}</div>
                            <div class="explanation">
                                <p>해설:</p>
                                <p>${question.explanation || `${question.paragraph}번째 문단의 첫 문장이 중심문장입니다. 
                                이 문장은 문단의 주요 내용을 함축적으로 제시하고 있으며, 
                                뒤따르는 문장들은 이 중심문장을 뒷받침하는 근거나 부연 설명을 제공합니다.`}</p>
                            </div>
                        </div>
                    </div>`;
            } else if (question.type === "요약") {
                questionsHTML += `
                    <div class="question">
                        <h4>${question.question}</h4>
                        <div class="answer-space large"></div>
                    </div>`;
                answersHTML += `
                    <div class="answer-item">
                        <div class="answer-number">${index + 1}번</div>
                        <div class="answer-content">
                            <div class="answer">정답 작성 방법</div>
                            <div class="explanation">
                                <p>해설:</p>
                                <p>${question.explanation || `1. 각 문단의 중심문장을 찾아 핵심 내용을 파악합니다.
                                2. 중심문장들을 자연스럽게 연결하여 전체 글의 흐름을 살립니다.
                                3. 불필요한 세부사항은 제외하고 핵심 내용만 간추려 작성합니다.
                                4. 글의 처음, 중간, 끝의 흐름이 논리적으로 연결되도록 작성합니다.`}</p>
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
