import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { parseExcelDataToJson } from './parser.js'; 

const SurveyForm = () => {
  const [surveyData, setSurveyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [openSections, setOpenSections] = useState({});
  const [showRisk, setShowRisk] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);

  useEffect(() => {
    const fetchSurveyData = async () => {
      // .envファイルからAPIのURLを読み込みます
      const apiUrl = import.meta.env.VITE_APP_GET_SURVEY_API_URL;
      if (!apiUrl) {
        setError('APIのURLが設定されていません。.envファイルを確認してください。');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error('データの取得に失敗しました１。');
        }
        const data = await response.json();
        const structuredData = parseExcelDataToJson(data); // ★ データを階層構造に変換
        setSurveyData(structuredData);                     // ★ 変換後のデータをセット
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSurveyData();
  }, []); // 空の依存配列で、コンポーネントのマウント時に一度だけ実行

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

    // APIのエンドポイントを環境変数から取得。ローカル開発用にデフォルト値を設定。
    const apiUrl = import.meta.env.VITE_SUBMIT_SURVEY_API_URL;
    if (!apiUrl) {
      setError('送信先のAPIのURLが設定されていません。.envファイルを確認してください。');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });

      if (response.ok) {
        setSubmissionStatus('success');
      } else {
        setSubmissionStatus('error');
      }
      } catch (err) {
        // ★★★ ここからが修正部分 ★★★
        console.error("APIへのフェッチ中にエラーが発生しました:", err);
        let errorMessage = 'データの取得に失敗しました２。';
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          errorMessage += ' ネットワークエラーまたはCORSの問題の可能性があります。APIのURLが正しいか、サーバーが起動しているか確認してください。';
        } else {
          errorMessage = err.message;
        }
        setError(errorMessage);
        // ★★★ 修正部分ここまで ★★★
      } finally {
        setLoading(false);
      }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <p className="text-lg text-slate-600">アンケートを読み込んでいます...</p>
      </div>
    );
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-red-600">エラー: {error}</div>;
  }

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-8 font-sans">
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
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? '送信中...' : '回答を送信'}
            </button>
            
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