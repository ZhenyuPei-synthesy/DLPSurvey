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
  
  // AI評価状態管理
  const [aiEvaluationStatus, setAiEvaluationStatus] = useState({});
  // key: subcategoryName, value: { status: 'pending'|'evaluating'|'completed'|'error', evaluationText: string, recommendationText: string, isLocked: boolean, isEditing: boolean }

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
                    let score = undefined;
                    const evaluation = savedAnswer.countermeasureEvaluation || savedAnswer.CountermeasureEvaluation || '';
                    
                    // 文書形式から数値スコアに逆変換
                    if (evaluation === "該当なし") {
                      score = 0;
                    } else if (evaluation && evaluation.trim() !== '') {
                      // item.optionsからテキストに対応するスコアを検索
                      const matchingOption = item.options?.find(opt => opt.text === evaluation);
                      if (matchingOption && matchingOption.score !== undefined) {
                        score = matchingOption.score;
                      } else {
                        // 数値として解析を試行
                        const numValue = parseInt(evaluation);
                        if (!isNaN(numValue)) {
                          score = numValue;
                        }
                      }
                    }
                    
                    const comment = savedAnswer.comment || savedAnswer.Comment || '';
                    
                    loadedAnswers[item.id] = {
                      score: score,
                      comment: comment || undefined
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

  // AI評価状態の復元
  useEffect(() => {
    const loadAiEvaluationStatus = async () => {
      try {
        const storedRespondentId = sessionStorage.getItem('respondentId');
        const currentRespondentId = storedRespondentId || respondentId;
        
        if (!currentRespondentId || surveyData.length === 0) return;

        const apiUrl = import.meta.env.MODE === 'development' 
          ? '/api/GetEvaluationStatus'
          : (import.meta.env.VITE_GET_EVALUATION_STATUS_API_URL || '/api/GetEvaluationStatus');

        const response = await fetch(`${apiUrl}?respondentId=${currentRespondentId}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.evaluations && result.evaluations.length > 0) {
            const restoredEvaluationStatus = {};
            
            // 中項目番号と名前をマッピング
            surveyData.forEach(category => {
              category.subcategories.forEach(subcategory => {
                const subcategoryId = subcategory.items[0]?.chuItemNumber;
                if (subcategoryId) {
                  const evaluation = result.evaluations.find(e => {
                    const responseSubcategoryId = e.subcategoryId || e.SubcategoryId || '';
                    return responseSubcategoryId === subcategoryId;
                  });
                  
                  if (evaluation) {
                    const status = (evaluation.status || evaluation.Status || '').toLowerCase();
                    
                    restoredEvaluationStatus[subcategory.name] = {
                      status: status,
                      evaluationText: evaluation.evaluationText || evaluation.EvaluationText || '',
                      recommendationText: evaluation.recommendationText || evaluation.RecommendationText || '',
                      isLocked: status === 'completed', // 完了済みの場合はロック
                      isEditing: false
                    };
                    
                    console.log(`AI評価状態を復元: ${subcategory.name}, status: ${status}`);
                  }
                }
              });
            });
            
            setAiEvaluationStatus(restoredEvaluationStatus);
            console.log('AI評価状態の復元完了:', restoredEvaluationStatus);
          }
        }
      } catch (err) {
        console.error("AI評価状態の読み込み中にエラー:", err);
      }
    };

    if (surveyData.length > 0) {
      loadAiEvaluationStatus();
    }
  }, [surveyData, respondentId]);

  const toggleSection = (categoryName) => {
    setOpenSections(prev => ({ ...prev, [categoryName]: !prev[categoryName] }));
  };

  const toggleRisk = (itemId) => {
    setShowRisk(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleScoreChange = (itemId, score) => {
    setAnswers(prev => {
      const newAnswers = { ...prev, [itemId]: { ...prev[itemId], score: score } };
      
      // 中項目の完了をチェックして自動AI評価開始
      setTimeout(() => checkAndStartAutoEvaluation(newAnswers), 100);
      
      return newAnswers;
    });
  };

  // 中項目完了時の自動AI評価開始チェック
  const checkAndStartAutoEvaluation = (currentAnswers) => {
    surveyData.forEach(category => {
      category.subcategories.forEach(subcategory => {
        // 新しい回答で完了判定
        const isNowCompleted = subcategory.items.every(item => {
          const answer = currentAnswers[item.id];
          return answer && answer.score !== undefined;
        });
        
        // 完了状態になり、まだAI評価が開始されていない場合のみ実行
        const evaluationStatus = aiEvaluationStatus[subcategory.name];
        const shouldStartEvaluation = isNowCompleted && 
          (!evaluationStatus || 
           (evaluationStatus.status === 'pending' && !evaluationStatus.isLocked && !evaluationStatus.isEditing));
        
        if (shouldStartEvaluation) {
          console.log(`中項目 "${subcategory.name}" が完了しました。自動AI評価を開始します。`);
          startAiEvaluation(subcategory, true); // 自動開始フラグをtrueに
        }
      });
    });
  };
  
  const handleCommentChange = (itemId, comment) => {
     setAnswers(prev => ({ ...prev, [itemId]: { ...prev[itemId], comment: comment } }));
  };

  // 中項目の完了判定
  const isSubcategoryCompleted = (subcategory) => {
    return subcategory.items.every(item => {
      const answer = answers[item.id];
      return answer && answer.score !== undefined;
    });
  };

  // 回答フィールドがロックされているかの判定
  const isSubcategoryLocked = (subcategory) => {
    const evaluationStatus = aiEvaluationStatus[subcategory.name];
    return evaluationStatus?.isLocked === true;
  };

  // 編集モードかどうかの判定
  const isSubcategoryInEditMode = (subcategory) => {
    const evaluationStatus = aiEvaluationStatus[subcategory.name];
    return evaluationStatus?.isEditing === true;
  };

  // AI評価の開始
  const startAiEvaluation = async (subcategory, isAutoStart = false) => {
    const storedRespondentId = sessionStorage.getItem('respondentId');
    const currentRespondentId = storedRespondentId || respondentId;
    
    if (!currentRespondentId) {
      console.error('回答者番号が見つかりません');
      return;
    }

    // 中項目番号を取得（最初のアイテムの中項目番号を使用）
    const subcategoryId = subcategory.items[0]?.chuItemNumber;
    
    if (!subcategoryId) {
      console.error('中項目番号が見つかりません');
      return;
    }

    // 中項目の現在の回答データを収集
    const currentAnswers = subcategory.items.map(item => {
      const answer = answers[item.id];
      let selectedAnswerText = '';
      
      if (answer && answer.score !== undefined) {
        if (answer.score === 0) {
          selectedAnswerText = '該当なし';
        } else {
          // スコアに対応する回答テキストを取得
          const matchingOption = item.options?.find(opt => opt.score === answer.score);
          selectedAnswerText = matchingOption ? matchingOption.text : answer.score.toString();
        }
      }

      return {
        questionText: item.question || '',
        selectedAnswerText: selectedAnswerText,
        score: answer?.score || 0,
        comment: answer?.comment || ''
      };
    }).filter(item => item.selectedAnswerText !== ''); // 未回答の項目は除外

    console.log('送信する回答データ:', currentAnswers);

    // AI評価状態を「評価中」に更新し、回答をロック
    setAiEvaluationStatus(prev => ({
      ...prev,
      [subcategory.name]: { 
        status: 'evaluating',
        isLocked: true,
        isEditing: false
      }
    }));

    try {
      const apiUrl = import.meta.env.MODE === 'development' 
        ? '/api/EvaluateSubcategory'
        : (import.meta.env.VITE_EVALUATE_SUBCATEGORY_API_URL || '/api/EvaluateSubcategory');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentId: currentRespondentId,
          subcategoryId: subcategoryId,
          currentAnswers: currentAnswers
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('AI評価開始:', result);
        
        // 評価完了を待つためのポーリング開始
        pollEvaluationStatus(currentRespondentId, subcategory.name, subcategoryId);
      } else {
        console.error('AI評価開始に失敗:', response.status);
        setAiEvaluationStatus(prev => ({
          ...prev,
          [subcategory.name]: { status: 'error', isLocked: false, isEditing: false }
        }));
      }
    } catch (error) {
      console.error('AI評価開始でエラー:', error);
      setAiEvaluationStatus(prev => ({
        ...prev,
        [subcategory.name]: { status: 'error', isLocked: false, isEditing: false }
      }));
    }
  };

  // AI評価状態のポーリング
  const pollEvaluationStatus = async (respondentId, subcategoryName, subcategoryId) => {
    const maxAttempts = 30; // 最大30回（約2.5分）
    let attempts = 0;
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        console.log(`AI評価のポーリング最大試行回数に達しました: ${subcategoryName}`);
        setAiEvaluationStatus(prev => ({
          ...prev,
          [subcategoryName]: { 
            ...prev[subcategoryName],
            status: 'error', 
            isLocked: false, 
            isEditing: false 
          }
        }));
        return;
      }
      
      attempts++;
      console.log(`AI評価状態チェック ${attempts}/${maxAttempts}: ${subcategoryName} (ID: ${subcategoryId})`);
      
      try {
        const apiUrl = import.meta.env.MODE === 'development' 
          ? '/api/GetEvaluationStatus'
          : (import.meta.env.VITE_GET_EVALUATION_STATUS_API_URL || '/api/GetEvaluationStatus');

        const response = await fetch(`${apiUrl}?respondentId=${respondentId}`);
        
        if (response.ok) {
          const result = await response.json();
          console.log('評価状態レスポンス:', result);
          
          // 中項目番号でマッチング
          const evaluation = result.evaluations?.find(e => {
            const responseSubcategoryId = e.subcategoryId || e.SubcategoryId || '';
            return responseSubcategoryId === subcategoryId;
          });
          
          if (evaluation) {
            const status = (evaluation.status || evaluation.Status || '').toLowerCase();
            console.log(`マッチした評価レコード見つかりました: ${subcategoryName}, status: ${status}`);
            
            if (status === 'completed') {
              setAiEvaluationStatus(prev => ({
                ...prev,
                [subcategoryName]: {
                  status: 'completed',
                  evaluationText: evaluation.evaluationText || evaluation.EvaluationText || '',
                  recommendationText: evaluation.recommendationText || evaluation.RecommendationText || '',
                  isLocked: true,
                  isEditing: false
                }
              }));
              console.log(`AI評価完了: ${subcategoryName}`);
              return;
            } else if (status === 'error') {
              setAiEvaluationStatus(prev => ({
                ...prev,
                [subcategoryName]: { 
                  ...prev[subcategoryName],
                  status: 'error', 
                  isLocked: false, 
                  isEditing: false 
                }
              }));
              console.log(`AI評価エラー: ${subcategoryName}`);
              return;
            }
          } else {
            console.log(`マッチする評価レコードが見つかりません: ${subcategoryName} (ID: ${subcategoryId})`);
          }
        }
        
        // 5秒後に再試行
        setTimeout(poll, 5000);
      } catch (error) {
        console.error('評価状態取得でエラー:', error);
        setTimeout(poll, 5000);
      }
    };
    
    // 最初の呼び出しを5秒後に実行
    setTimeout(poll, 5000);
  };

  // 編集モードに切り替え
  const switchToEditMode = (subcategory) => {
    console.log(`編集モードに切り替え: ${subcategory.name}`);
    setAiEvaluationStatus(prev => ({
      ...prev,
      [subcategory.name]: {
        ...prev[subcategory.name],
        isLocked: false,
        isEditing: true,
        status: 'pending' // 編集モードでは評価リセット
      }
    }));
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
      
      // セッションストレージから回答者番号を取得
      const storedRespondentId = sessionStorage.getItem('respondentId');
      const currentRespondentId = storedRespondentId || respondentId;

      if (!currentRespondentId) {
        setError('回答者番号が見つかりません。最初からやり直してください。');
        setIsSubmitting(false);
        return;
      }

      // 回答データを整理してAPIに送信する形式に変換（全項目を送信、未回答はNULL）
      const answerItems = [];

      // surveyDataから質問情報を取得し、answersと組み合わせる（全項目をループ）
      surveyData.forEach(category => {
        category.subcategories.forEach(subcategory => {
          subcategory.items.forEach(item => {
            const answer = answers[item.id];

            // スコアを文書形式に変換（GetSurveyQuestionsと同じ形式）
            let evaluationText = null;
            if (answer && answer.score !== undefined) {
              if (answer.score === 0) {
                evaluationText = "該当なし";
              } else {
                const matchingOption = item.options?.find(opt => opt.score === answer.score);
                evaluationText = matchingOption ? matchingOption.text : answer.score.toString();
              }
            }

            // 全項目を送信（未回答はNULLとして送る）
            answerItems.push({
              itemId: item.id,
              questionNumber: item.questionNumber,
              chuItemNumber: item.chuItemNumber,
              category: category.category,
              subcategory: subcategory.name,
              question: item.question,
              countermeasureEvaluation: evaluationText, // 未回答は null のまま
              comment: answer?.comment || null
            });
          });
        });
      });
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentId: currentRespondentId,
          answerItems: answerItems
        }),
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

      // 回答データを整理してAPIに送信する形式に変換（全項目を送信、未回答も含む）
      const answerItems = [];

      // surveyDataから質問情報を取得し、answersと組み合わせる（全項目をループ）
      surveyData.forEach(category => {
        category.subcategories.forEach(subcategory => {
          subcategory.items.forEach(item => {
            const answer = answers[item.id];
            
            // スコアを文書形式に変換（GetSurveyQuestionsと同じ形式）
            let evaluationText = null;
            if (answer && answer.score !== undefined) {
              if (answer.score === 0) {
                evaluationText = "該当なし";
              } else {
                // item.optionsからスコアに対応するテキストを検索
                const matchingOption = item.options?.find(opt => opt.score === answer.score);
                evaluationText = matchingOption ? matchingOption.text : answer.score.toString();
              }
            }
            
            // 全項目を送信（回答の有無に関わらず）
            answerItems.push({
              itemId: item.id,
              questionNumber: item.questionNumber,
              chuItemNumber: item.chuItemNumber,
              category: category.category,
              subcategory: subcategory.name,
              question: item.question,
              countermeasureEvaluation: evaluationText, // 文書形式で送信
              comment: answer?.comment || null // コメントも送信
            });
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

  // 回答進捗を計算
  const calculateProgress = () => {
    let totalQuestions = 0;
    let answeredQuestions = 0;

    surveyData.forEach(category => {
      category.subcategories.forEach(subcategory => {
        subcategory.items.forEach(item => {
          totalQuestions++;
          const answer = answers[item.id];
          if (answer && answer.score !== undefined) {
            answeredQuestions++;
          }
        });
      });
    });

    return { answeredQuestions, totalQuestions };
  };

  const { answeredQuestions, totalQuestions } = calculateProgress();

  return (
    <div className="bg-slate-50 h-full font-sans">
      {/* 固定進捗表示ヘッダー */}
      <div className="fixed top-48 left-0 right-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex justify-center">
            <div className="bg-blue-50 px-4 py-2 rounded-full border border-blue-200">
              <span className="text-blue-800 font-medium text-sm">
                回答進捗：{answeredQuestions}問/{totalQuestions}問
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ - 固定ヘッダー分のパディングを追加 */}
      <div className="p-4 sm:p-8" style={{ paddingTop: '5rem' }}>
        <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {surveyData.map((category) => {
              // 各大項目の質問数を合計 (中項目内のitems数を集計)
              const questionCount = (category.subcategories || []).reduce((acc, sc) => acc + ((sc.items && sc.items.length) || 0), 0);

              return (
                <div key={category.category} className="border border-gray-200 rounded-lg shadow-sm bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSection(category.category)}
                    className="w-full flex items-center p-5 font-semibold text-xl text-left text-slate-800"
                  >
                    <div className="flex items-center w-full">
                      <div className="flex items-center">
                        <span>{category.category}</span>
                        {/* 大項目の後ろに () で質問数を表示（例： (8問) ） */}
                        <span className="ml-3 text-lg text-slate-500 tabular-nums">({questionCount}問)</span>
                      </div>
                      <ChevronDownIcon 
                        className={`w-6 h-6 ml-auto transition-transform ${openSections[category.category] ? 'rotate-180' : ''}`} 
                      />
                    </div>
                  </button>
                
                {openSections[category.category] && (
                  <div className="px-5 pb-5 border-t border-gray-200">
                    {/* ★★★ ここからが完全に復元された描画部分です ★★★ */}
                    {category.subcategories.map((subcategory) => (
                      <div key={subcategory.name} className="pt-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-slate-700">{subcategory.name}</h3>
                          
                          {/* AI評価ボタン */}
                          <div className="flex items-center space-x-2">
                            {isSubcategoryCompleted(subcategory) && (
                              <>
                                {/* 評価中 */}
                                {aiEvaluationStatus[subcategory.name]?.status === 'evaluating' && (
                                  <div className="flex items-center text-blue-600">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                    <span className="text-sm">AIによる評価中</span>
                                  </div>
                                )}
                                
                                {/* 評価完了（ロック中） */}
                                {aiEvaluationStatus[subcategory.name]?.status === 'completed' && 
                                 aiEvaluationStatus[subcategory.name]?.isLocked && 
                                 !aiEvaluationStatus[subcategory.name]?.isEditing && (
                                  <div className="flex items-center space-x-2">
                                    <div className="flex items-center text-green-600">
                                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span className="text-sm">AI評価完了</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => switchToEditMode(subcategory)}
                                      className="px-3 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-md hover:bg-orange-200 transition-colors"
                                    >
                                      回答を編集
                                    </button>
                                  </div>
                                )}
                                
                                {/* 編集モード（手動AI評価開始） */}
                                {aiEvaluationStatus[subcategory.name]?.isEditing && (
                                  <div className="flex items-center space-x-2">
                                    <div className="flex items-center text-orange-600">
                                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      <span className="text-sm">回答を編集中</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => startAiEvaluation(subcategory, false)}
                                      className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
                                    >
                                      AI評価を開始
                                    </button>
                                  </div>
                                )}
                                
                                {/* 初回評価またはエラー時 */}
                                {(!aiEvaluationStatus[subcategory.name] || 
                                  aiEvaluationStatus[subcategory.name]?.status === 'error' ||
                                  (aiEvaluationStatus[subcategory.name]?.status === 'pending' && !aiEvaluationStatus[subcategory.name]?.isEditing)) && (
                                  <div className="flex items-center text-gray-500">
                                    <span className="text-sm">回答完了時に自動でAI評価を開始します</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-8">
                          {subcategory.items.map((item) => {
                            const isDisabled = isSubcategoryLocked(subcategory);
                            return (
                            <div key={item.id}>
                              <p className="font-semibold text-slate-800 mb-4">{item.question}</p>
                              <div className="space-y-3">
                                {item.options.map((option) => (
                                  <label key={option.score} className={`flex items-start p-4 border rounded-lg transition-colors ${
                                    isDisabled 
                                      ? 'bg-gray-50 cursor-not-allowed opacity-70' 
                                      : 'cursor-pointer hover:bg-slate-50'
                                  }`}>
                                    <input
                                      type="radio"
                                      name={item.id}
                                      value={option.score}
                                      checked={answers[item.id]?.score === option.score}
                                      onChange={() => handleScoreChange(item.id, option.score)}
                                      disabled={isDisabled}
                                      className="sr-only peer"
                                    />
                                    <div className={`flex-shrink-0 w-6 h-6 border-2 border-slate-300 rounded-full flex items-center justify-center text-sm font-bold text-slate-400 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:text-white ${
                                      isDisabled ? 'opacity-50' : ''
                                    }`}>
                                      {option.score}
                                    </div>
                                    <span className={`ml-4 ${isDisabled ? 'text-slate-400' : 'text-slate-600'}`}>{option.text}</span>
                                  </label>
                                ))}
                                <label className={`flex items-start p-4 border rounded-lg transition-colors ${
                                  isDisabled 
                                    ? 'bg-gray-50 cursor-not-allowed opacity-70' 
                                    : 'cursor-pointer hover:bg-slate-50'
                                }`}>
                                  <input
                                    type="radio"
                                    name={item.id}
                                    value={0}
                                    checked={answers[item.id]?.score === 0}
                                    onChange={() => handleScoreChange(item.id, 0)}
                                    disabled={isDisabled}
                                    className="sr-only peer"
                                  />
                                  <div className={`flex-shrink-0 w-6 h-6 border-2 border-slate-300 rounded-full flex items-center justify-center text-sm font-bold text-slate-400 peer-checked:bg-slate-600 peer-checked:border-slate-600 peer-checked:text-white ${
                                    isDisabled ? 'opacity-50' : ''
                                  }`}>0</div>
                                  <span className={`ml-4 ${isDisabled ? 'text-slate-400' : 'text-slate-600'}`}>該当なし</span>
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
                                  disabled={isDisabled}
                                  className={`w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                                    isDisabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                                  }`}
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
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {/* ★★★ 描画部分ここまで ★★★ */}
                  </div>
                )}
              </div>
            );
            })}
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
    </div>
  );
};

export default SurveyForm;