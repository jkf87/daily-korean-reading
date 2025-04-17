document.addEventListener('DOMContentLoaded', function() {
    // DOM 요소들을 가져옵니다
    const passageText = document.getElementById('passage-text');
    const questionsContainer = document.getElementById('questions');
    
    // API 키 설정 - 로컬 스토리지에서 불러옵니다
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

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{
                            text: `다음 요구사항에 맞는 비문학 지문과 문제를 생성해주세요:
                            1. 초등학생 수준의 교과서에 나올 수 있는 비문학 지문을 작성해주세요.
                            2. 지문은 3~4개의 문단으로 구성되어야 합니다.
                            3. 각 문단은 명확한 중심문장을 포함해야 합니다.
                            4. 지문의 전체 길이는 800자 내외여야 합니다.
                            5. 마크다운이나 특수 문자를 사용하지 말고, 순수 텍스트로만 작성해주세요.
                            6. 각 문단은 일반적인 들여쓰기만 사용하고, 특별한 구분자나 기호를 사용하지 마세요.
                            7. 다음 JSON 형식으로만 출력해주세요:
                            {
                                "title": "제목 (특수문자 없이)",
                                "content": "지문 내용 (각 문단은 일반 줄바꿈으로만 구분)",
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
                                        "wrongOptionIndex": 0
                                    },
                                    {
                                        "type": "중심문장",
                                        "paragraph": 1,
                                        "question": "2. 첫 번째 문단의 중심문장을 찾아 쓰시오."
                                    },
                                    {
                                        "type": "중심문장",
                                        "paragraph": 2,
                                        "question": "3. 두 번째 문단의 중심문장을 찾아 쓰시오."
                                    },
                                    {
                                        "type": "중심문장",
                                        "paragraph": 3,
                                        "question": "4. 세 번째 문단의 중심문장을 찾아 쓰시오."
                                    },
                                    {
                                        "type": "요약",
                                        "question": "5. 이 글을 요약해서 세 문장으로 쓰시오."
                                    }
                                ]
                            }`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        topK: 32,
                        topP: 0.8,
                        maxOutputTokens: 4096
                    }
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            console.log('API 응답:', data); // 디버깅용

            // candidates 배열이 존재하는지 확인
            if (!data.candidates || !data.candidates.length || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts.length) {
                console.error('API 응답 구조 오류:', data);
                throw new Error('API 응답 형식이 올바르지 않습니다. 다시 시도해주세요.');
            }

            const generatedText = data.candidates[0].content.parts[0].text;
            
            // JSON 형식 문자열 찾기
            const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('JSON 형식 찾기 실패:', generatedText);
                throw new Error('생성된 응답에서 JSON 형식을 찾을 수 없습니다. 다시 시도해주세요.');
            }

            let generatedContent;
            try {
                generatedContent = JSON.parse(jsonMatch[0]);
                
                // 필수 필드 확인
                if (!generatedContent.title || !generatedContent.content || !generatedContent.questions) {
                    throw new Error('JSON 응답에 필수 필드가 없습니다.');
                }
                
                // questions 배열 확인
                if (!Array.isArray(generatedContent.questions) || generatedContent.questions.length === 0) {
                    throw new Error('questions 배열이 올바르지 않습니다.');
                }
            } catch (jsonError) {
                console.error('JSON 파싱 오류:', jsonError, jsonMatch[0]);
                throw new Error('응답 데이터 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
            }
            
            // wrongOptionIndex가 없으면 랜덤하게 생성
            if (!generatedContent.questions[0].wrongOptionIndex) {
                generatedContent.questions[0].wrongOptionIndex = Math.floor(Math.random() * 4);
            }
            
            displayPassage(generatedContent);
        } catch (error) {
            console.error('Error:', error);
            alert('지문 생성 중 오류가 발생했습니다: ' + error.message);
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
                const wrongIndex = question.wrongOptionIndex || 0;
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
                
                // 해설 생성 개선
                const wrongOption = question.options[wrongIndex];
                const wrongSymbol = ['①', '②', '③', '④'][wrongIndex];
                
                answersHTML += `
                    <div class="answer-item">
                        <div class="answer-number">1.</div>
                        <div class="answer-content">
                            <div class="answer">정답: ${wrongSymbol}</div>
                            <div class="explanation">
                                해설: 글의 내용과 일치하지 않는 것은 ${wrongSymbol} "${wrongOption}"입니다. 
                                ${wrongIndex === 0 ? '첫 번째 문단에서 "우리 주변에는 눈에 보이지 않는 작은 세균들이 많이 살고 있어요"라고 했으므로, 세균은 눈으로 직접 볼 수 없습니다.' : ''}
                                ${wrongIndex === 1 ? '두 번째 문단에서 "손을 깨끗이 씻는 것은 세균을 없애는 가장 좋은 방법이에요"라고 했으므로, 이 선택지는 글의 내용과 일치하지 않습니다.' : ''}
                                ${wrongIndex === 2 ? '두 번째 문단에서 "특히 바깥에서 놀고 온 뒤, 화장실에 다녀온 뒤, 밥을 먹기 전에는 꼭 손을 씻어야 합니다"라고 했으므로, 이 선택지는 글의 내용과 일치하지 않습니다.' : ''}
                                ${wrongIndex === 3 ? '두 번째 문단에서 "물로만 씻는 것보다 비누를 사용하면 훨씬 더 많은 세균을 없앨 수 있어요"라고 했으므로, 이 선택지는 글의 내용과 일치하지 않습니다.' : ''}
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
                let mainSentence = '';
                
                // 첫 번째 문장을 중심문장으로 취급
                if (paragraphs.length >= question.paragraph) {
                    const sentences = paragraphs[question.paragraph - 1].split('.');
                    if (sentences.length > 0) {
                        mainSentence = sentences[0] + '.';
                    }
                }
                
                answersHTML += `
                    <div class="answer-item">
                        <div class="answer-number">${index + 1}.</div>
                        <div class="answer-content">
                            <div class="answer">정답: ${mainSentence}</div>
                            <div class="explanation">
                                해설: ${question.paragraph}번째 문단의 첫 문장이 중심문장입니다. 
                                이 문장은 해당 문단에서 전달하고자 하는 핵심 내용을 담고 있으며, 
                                이어지는 문장들은 이 중심문장을 부연 설명하거나 구체적인 예시를 제공합니다.
                            </div>
                        </div>
                    </div>`;
            } else if (question.type === "요약") {
                questionsHTML += `
                    <div class="question">
                        <h4>${question.question}</h4>
                        <div class="answer-space large"></div>
                    </div>`;
                
                // 요약문제 해설 개선
                const paragraphs = passage.content.split('\n').filter(p => p.trim());
                const mainIdeas = paragraphs.map(p => p.split('.')[0] + '.').join(' ');
                
                answersHTML += `
                    <div class="answer-item">
                        <div class="answer-number">${index + 1}.</div>
                        <div class="answer-content">
                            <div class="answer">정답 예시</div>
                            <div class="explanation">
                                해설: 각 문단의 중심문장을 토대로 요약하면 다음과 같습니다:
                                "${mainIdeas}"
                                
                                요약문 작성 방법:
                                1. 각 문단의 중심문장을 찾아 핵심 내용을 파악합니다.
                                2. 찾아낸 중심문장들을 자연스럽게 연결하여 전체 글의 흐름을 살립니다.
                                3. 불필요한 세부사항은 제외하고 핵심 내용만 간추려 작성합니다.
                                4. 글의 처음, 중간, 끝의 흐름이 논리적으로 연결되도록 작성합니다.
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
    
    // 새로운 지문 생성 버튼 이벤트 리스너
    document.getElementById('new-passage').addEventListener('click', generatePassageWithGemini);
    
    // 인쇄 버튼 이벤트 리스너
    document.getElementById('print-sheet').addEventListener('click', function() {
        window.print();
    });
}); 
