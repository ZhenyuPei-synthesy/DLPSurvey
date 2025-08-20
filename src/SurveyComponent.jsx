// src/SurveyComponent.jsx

import React, { useState, useEffect } from 'react';
import { parseExcelDataToJson } from './parser.js'; // 先ほど作成した関数をインポート

// Excelから読み込んだと仮定するサンプルデータ
const rawDataFromExcel = [
  { "大項目": "1. 全社的・組織的背景", "中項目": "1.2. 信頼の肯定と分類", "チェック項目": "5. 信頼の重要度に応じた分類（例：極秘、秘、社外秘）と、それに準じた取扱ルールが定められているか。", "対策計画": "3. 信頼の重要度に応じた分類基準（例：「極秘」）と、それに準じた取扱ルールが定められているか。", "リスク": "リスクあり" },
  { "大項目": "1. 全社的・組織的背景", "中項目": "1.2. 信頼の肯定と分類", "チェック項目": "6. 信頼の分類（ラベリング）と、それに準じた取扱ルールが定められているか。", "対策計画": "4. 分類ごとに、アクセス制御、複製、持ち出し、...", "リスク": "リスクあり" },
  { "大項目": "1. 全社的・組織的背景", "中項目": "1.2. 信頼の肯定と分類", "チェック項目": "7. 新規プロジェクト開始時に、創出される信頼の防護方法を定義するプロセスがあるか。", "対策計画": "1. 新規プロジェクトで扱われる信頼の管理は、...", "リスク": "リスクあり" },
  { "大項目": "2. 人的背景", "中項目": "2.1. 採用・入社時", "チェック項目": "9. 全ての従業員（正社員、契約、派遣含む）から、秘密保持に関する誓約書を入社時に取得しているか。", "対策計画": "1. 秘密保持に関する誓約書は取得していない。", "リスク": "リスクあり" }
];


const SurveyComponent = () => {
  const [surveyData, setSurveyData] = useState([]);

  useEffect(() => {
    const structuredData = parseExcelDataToJson(rawDataFromExcel);
    setSurveyData(structuredData);
  }, []);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">アンケート項目</h1>
      {surveyData.map((category) => (
        <div key={category.category} className="mb-8">
          <h2 className="text-2xl font-semibold bg-blue-600 text-white p-3 rounded-t-lg">
            {category.category}
          </h2>
          <div className="bg-white shadow-md rounded-b-lg">
            {category.subcategories.map((subcategory) => (
              <div key={subcategory.name} className="p-4 border-b last:border-b-0">
                <h3 className="text-xl font-bold text-gray-700 mb-3">{subcategory.name}</h3>
                <ul>
                  {subcategory.items.map((item) => (
                    <li key={item.id} className="mb-2 p-3 bg-gray-100 rounded">
                      <p className="font-medium text-gray-900">【チェック項目】 {item.checkItem}</p>
                      <p className="text-sm text-gray-600 mt-1">【対策計画】 {item.measure}</p>
                      <p className={`text-sm font-bold mt-1 ${item.risk === 'リスクあり' ? 'text-red-600' : 'text-green-600'}`}>
                        【リスク】 {item.risk}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SurveyComponent;