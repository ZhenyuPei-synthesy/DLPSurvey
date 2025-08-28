import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { parseExcelDataToJson } from './parser.js'; 

  const SurveyForm = ({ respondentId, onComplete, onTemporarySaved }) => {
  const [surveyData, setSurveyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [openSections, setOpenSections] = useState({});
  const [showRisk, setShowRisk] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [isSavingTemporary, setIsSavingTemporary] = useState(false);
  const [tempSaveStatus, setTempSaveStatus] = useState(null);

  useEffect(() => {
    const fetchSurveyData = async () => {
      // 本番環境用のAPIのURL設定
      const apiUrl = import.meta.env.VITE_APP_GET_SURVEY_API_URL;
      
      console.log('🚀 Production API URL:', apiUrl);
      console.log('🚀 Environment variables:', {
        GET_API: import.meta.env.VITE_APP_GET_SURVEY_API_URL,
        SUBMIT_API: import.meta.env.VITE_SUBMIT_SURVEY_API_URL,
        MODE: import.meta.env.MODE
      });
      
      if (!apiUrl) {
        setError('APIのURLが設定されていません。環境変数を確認してください。');
        setLoading(false);
        return;
      }

      try {
        console.log('🚀 Step 1: Fetching from:', apiUrl);
        
        // フェッチにタイムアウトとリトライ機能を追加
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト
        
        const response = await fetch(apiUrl, {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'DLP-Survey-App/1.0'
          },
          mode: 'cors',
          cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        console.log('🚀 Step 2: Response received:', response.status, response.ok);
        
        if (!response.ok) {
          throw new Error(`データの取得に失敗しました。ステータス: ${response.status}`);
        }
        
        console.log('🚀 Step 3: Parsing JSON...'); // デバッグ用
        const data = await response.json();
        console.log('🚀 Step 4: JSON parsed successfully. Data length:', data?.length); // デバッグ用
        console.log('🚀 Step 5: Sample data:', data?.slice(0, 2)); // 最初の2件だけ表示
        
        console.log('🚀 Step 6: Starting parseExcelDataToJson...'); // デバッグ用
        const structuredData = parseExcelDataToJson(data); // ★ データを階層構造に変換
        console.log('🚀 Step 7: Parsing completed. Categories:', structuredData?.length); // デバッグ用
        console.log('🚀 Step 8: Sample structured data:', structuredData?.[0]); // 最初のカテゴリだけ表示
        
        console.log('🚀 Step 9: Setting survey data...'); // デバッグ用
        setSurveyData(structuredData);                     // ★ 変換後のデータをセット
        console.log('🚀 Step 10: Survey data set successfully!'); // デバッグ用
        
      } catch (err) {
        console.error('❌ ERROR occurred at step:', err); // デバッグ用
        console.error('❌ Error stack:', err.stack); // スタックトレースも表示
        setError(`エラーが発生しました: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSurveyData();
  }, []); // 空の依存配列で、コンポーネントのマウント時に一度だけ実行

  // 一時保存された回答を読み込む
  useEffect(() => {
    const loadSavedAnswers = async () => {
      try {
        const storedRespondentId = sessionStorage.getItem('respondentId');
        const currentRespondentId = storedRespondentId || respondentId;
        
        if (!currentRespondentId || surveyData.length === 0) return;

        const apiUrl = import.meta.env.MODE === 'development' 
          ? '/api/LoadAnswersTemporary'
          : (import.meta.env.VITE_LOAD_TEMPORARY_API_URL || '/api/LoadAnswersTemporary');

        const response = await fetch(`${apiUrl}?respondentId=${currentRespondentId}`);
        
        if (response.ok) {
          const savedAnswers = await response.json();
          if (savedAnswers.success && savedAnswers.answers && savedAnswers.answers.length > 0) {
            const loadedAnswers = {};
            
            // questionNumberでマッチングして回答を復元
            surveyData.forEach(category => {
              category.subcategories.forEach(subcategory => {
                subcategory.items.forEach(item => {
                  const savedAnswer = savedAnswers.answers.find(saved => {
                    const savedQNum = saved.questionNumber || saved.QuestionNumber || '';
                    const savedChu = saved.chuItemNumber || saved.ChuItemNumber || '';
                    // If both have chuItemNumber, match both; otherwise fallback to questionNumber only
                    if (savedChu && item.chuItemNumber) {
                      return savedQNum === item.questionNumber && savedChu === item.chuItemNumber;
                    }
                    return savedQNum === item.questionNumber;
                  });
                  
                  if (savedAnswer) {
                    loadedAnswers[item.id] = {
                      score: savedAnswer.countermeasureEvaluation ? parseInt(savedAnswer.countermeasureEvaluation) : undefined
                    };
                  }
                });
              });
            });
            
            setAnswers(loadedAnswers);
          }
        }
      } catch (err) {
        console.error("一時保存された回答の読み込み中にエラー:", err);
      }
    };

    if (surveyData.length > 0) {
      loadSavedAnswers();
    }
  }, [surveyData, respondentId]);

  const toggleSection = (categoryName) => {
    setOpenSections(prev => ({ ...prev, [categoryName]: !prev[categoryName] }));
  };

  const toggleRisk = (itemId) => {
    setShowRisk(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleScoreChange = (itemId, score) => {
    setAnswers(prev => ({ ...prev, [itemId]: { ...prev[itemId], score: score } }));
  };
  
  const handleCommentChange = (itemId, comment) => {
     setAnswers(prev => ({ ...prev, [itemId]: { ...prev[itemId], comment: comment } }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmissionStatus(null);

    // APIのエンドポイントを環境変数から取得
    const apiUrl = import.meta.env.VITE_SUBMIT_SURVEY_API_URL;
    if (!apiUrl) {
      setError('送信先のAPIのURLが設定されていません。.envファイルを確認してください。');
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('Submitting answers:', answers);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });

      if (response.ok) {
        setSubmissionStatus('success');
        // アンケート回答完了後、レポート画面に遷移
        setTimeout(() => {
          onComplete(answers, surveyData);
        }, 1000);
      } else {
        setSubmissionStatus('error');
      }
      } catch (err) {
        console.error("APIへのフェッチ中にエラーが発生しました:", err);
        let errorMessage = 'データの送信に失敗しました。';
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          errorMessage += ' ネットワークエラーまたはCORSの問題の可能性があります。APIのURLが正しいか、サーバーが起動しているか確認してください。';
        } else {
          errorMessage = err.message;
        }
        setError(errorMessage);
        setSubmissionStatus('error');
      } finally {
        setIsSubmitting(false);
      }
  };

  const handleTemporarySave = async () => {
    setIsSavingTemporary(true);
    setTempSaveStatus(null);

    try {
      // セッションストレージから回答者番号を取得
      const storedRespondentId = sessionStorage.getItem('respondentId');
      const currentRespondentId = storedRespondentId || respondentId;

      if (!currentRespondentId) {
        setTempSaveStatus('error');
        alert('回答者番号が見つかりません。最初からやり直してください。');
        return;
      }

      // 回答データを整理してAPIに送信する形式に変換
      const answerItems = [];

      // surveyDataから質問情報を取得し、answersと組み合わせる
      surveyData.forEach(category => {
        category.subcategories.forEach(subcategory => {
          subcategory.items.forEach(item => {
            const answer = answers[item.id];
            if (answer && answer.score !== undefined) {
              answerItems.push({
                itemId: item.id,
                questionNumber: item.questionNumber,
                chuItemNumber: item.chuItemNumber,
                category: category.category,
                subcategory: subcategory.name,
                question: item.question,
                countermeasureEvaluation: answer.score !== undefined ? answer.score.toString() : null
              });
            }
          });
        });
      });

      // 一時保存API呼び出し
      const apiUrl = import.meta.env.MODE === 'development' 
        ? '/api/SaveAnswersTemporary'
        : (import.meta.env.VITE_SAVE_TEMPORARY_API_URL || '/api/SaveAnswersTemporary');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentId: currentRespondentId,
          answerItems: answerItems
        }),
      });

      if (response.ok) {
        setTempSaveStatus('success');
        // try to read answerNumber from response
        try {
          const json = await response.json();
          const answerNumber = json?.answerNumber || sessionStorage.getItem('answerNumber');
          const email = sessionStorage.getItem('respondentEmail') || null;
          if (answerNumber) sessionStorage.setItem('answerNumber', answerNumber);
          if (onTemporarySaved) onTemporarySaved(answerNumber, email);
        } catch (e) {
          // ignore JSON parse errors
        }
        setTimeout(() => setTempSaveStatus(null), 3000); // 3秒後にメッセージを消す
      } else {
        setTempSaveStatus('error');
      }
    } catch (err) {
      console.error("一時保存中にエラーが発生しました:", err);
      setTempSaveStatus('error');
    } finally {
      setIsSavingTemporary(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full bg-slate-50">
        <p className="text-lg text-slate-600">アンケートを読み込んでいます...</p>
      </div>
    );
  }

  if (error) {
    return <div className="flex justify-center items-center h-full bg-slate-50 text-red-600">エラー: {error}</div>;
  }

  return (
    <div className="bg-slate-50 h-full p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {surveyData.map((category) => (
              <div key={category.category} className="border border-gray-200 rounded-lg shadow-sm bg-white">
                <button
                  type="button"
                  onClick={() => toggleSection(category.category)}
                  className="w-full flex justify-between items-center p-5 font-semibold text-xl text-left text-slate-800"
                >
                  <span>{category.category}</span>
                  <ChevronDownIcon 
                    className={`w-6 h-6 transition-transform ${openSections[category.category] ? 'rotate-180' : ''}`} 
                  />
                </button>
                
                {openSections[category.category] && (
                  <div className="px-5 pb-5 border-t border-gray-200">
                    {/* ★★★ ここからが完全に復元された描画部分です ★★★ */}
                    {category.subcategories.map((subcategory) => (
                      <div key={subcategory.name} className="pt-5">
                        <h3 className="text-lg font-bold text-slate-700 mb-4">{subcategory.name}</h3>
                        <div className="space-y-8">
                          {subcategory.items.map((item) => (
                            <div key={item.id}>
                              <p className="font-semibold text-slate-800 mb-4">{item.question}</p>
                              <div className="space-y-3">
                                {item.options.map((option) => (
                                  <label key={option.score} className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input
                                      type="radio"
                                      name={item.id}
                                      value={option.score}
                                      checked={answers[item.id]?.score === option.score}
                                      onChange={() => handleScoreChange(item.id, option.score)}
                                      className="sr-only peer"
                                    />
                                    <div className="flex-shrink-0 w-6 h-6 border-2 border-slate-300 rounded-full flex items-center justify-center text-sm font-bold text-slate-400
                                                    peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:text-white">
                                      {option.score}
                                    </div>
                                    <span className="ml-4 text-slate-600">{option.text}</span>
                                  </label>
                                ))}
                                <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                  <input
                                    type="radio"
                                    name={item.id}
                                    value={0}
                                    checked={answers[item.id]?.score === 0}
                                    onChange={() => handleScoreChange(item.id, 0)}
                                    className="sr-only peer"
                                  />
                                  <div className="flex-shrink-0 w-6 h-6 border-2 border-slate-300 rounded-full flex items-center justify-center text-sm font-bold text-slate-400
                                                  peer-checked:bg-slate-600 peer-checked:border-slate-600 peer-checked:text-white">0</div>
                                  <span className="ml-4 text-slate-600">該当なし</span>
                                </label>
                              </div>
                              <div className="mt-4">
                                <label htmlFor={`comment-${item.id}`} className="block text-sm font-medium text-slate-600 mb-1">コメント</label>
                                <textarea
                                  id={`comment-${item.id}`}
                                  rows="3"
                                  value={answers[item.id]?.comment || ''}
                                  onChange={(e) => handleCommentChange(item.id, e.target.value)}
                                  placeholder="具体的な状況や課題などを入力..."
                                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                              <div className="mt-4">
                                <button
                                  type="button"
                                  onClick={() => toggleRisk(item.id)}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <InformationCircleIcon className="w-5 h-5 mr-2" />
                                  リスクを表示
                                </button>
                                {showRisk[item.id] && (
                                  <div className="mt-3 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
                                    <p><strong className="font-bold">リスク:</strong> {item.risk}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {/* ★★★ 描画部分ここまで ★★★ */}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm text-center">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                type="button"
                onClick={handleTemporarySave}
                disabled={isSavingTemporary}
                className="px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                {isSavingTemporary ? '保存中...' : '一時保存'}
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? '送信中...' : '回答を送信'}
              </button>
            </div>
            
            {tempSaveStatus === 'success' && (
              <p className="mt-4 text-green-600">一時保存が完了しました。</p>
            )}
            {tempSaveStatus === 'error' && (
              <p className="mt-4 text-red-600">一時保存に失敗しました。時間をおいて再度お試しください。</p>
            )}
            
            {submissionStatus === 'success' && (
              <p className="mt-4 text-green-600">回答が正常に送信されました。ご協力ありがとうございます！</p>
            )}
            {submissionStatus === 'error' && (
              <p className="mt-4 text-red-600">送信に失敗しました。時間をおいて再度お試しください。</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default SurveyForm;