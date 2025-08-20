import React, { useState } from 'react';
import { ChevronDownIcon, InformationCircleIcon } from '@heroicons/react/24/solid';

const SurveyForm = ({ surveyData }) => {
  const [answers, setAnswers] = useState({});
  const [openSections, setOpenSections] = useState({});
  // ★ 新しいState: 各質問のリスク表示状態を管理 (例: { "item-1": true, "item-2": false })
  const [showRisk, setShowRisk] = useState({});

  const toggleSection = (categoryName) => {
    setOpenSections(prev => ({ ...prev, [categoryName]: !prev[categoryName] }));
  };

  // ★ 新しい関数: 特定の質問のリスク表示を切り替える
  const toggleRisk = (itemId) => {
    setShowRisk(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleScoreChange = (itemId, score) => {
    setAnswers(prev => ({ ...prev, [itemId]: { ...prev[itemId], score: score } }));
  };
  
  const handleCommentChange = (itemId, comment) => {
     setAnswers(prev => ({ ...prev, [itemId]: { ...prev[itemId], comment: comment } }));
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {surveyData.map((category) => (
          <div key={category.category} className="mb-4 border border-gray-200 rounded-lg shadow-sm bg-white">
            <button
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
                          {/* ★ ここからが追加部分 */}
                          <div className="mt-4">
                            <button
                              onClick={() => toggleRisk(item.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <InformationCircleIcon className="w-5 h-5 mr-2" />
                              リスクと解答例を表示
                            </button>
                            {/* ★ Stateに応じてリスク情報を表示 */}
                            {showRisk[item.id] && (
                              <div className="mt-3 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
                                <p><strong className="font-bold">リスク:</strong> {item.risk}</p>
                              </div>
                            )}
                          </div>
                          {/* ★ 追加部分ここまで */}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SurveyForm;