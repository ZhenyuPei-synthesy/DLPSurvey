import React from 'react';
import SurveyForm from './SurveyForm';

// 新しいデータ構造に合わせたサンプルデータに "risk" を追加
const newStructuredSurveyData = [
  {
    category: "1. 全社的・組織的管理",
    subcategories: [
      {
        name: "1.1. 方針とガバナンス",
        items: [
          {
            id: "item-1",
            question: "1. 全社的な情報管理規程（営業秘密管理規程など）が策定され、経営層によって承認されているか。",
            options: [
              { score: 1, text: "情報管理に関する規程やルールは存在しない。" },
              { score: 2, text: "情報管理に関する規程は存在するが、従業員等に具体的に示されておらず、秘密として管理する会社の意思が明確になっていない。" },
              { score: 3, text: "経営層が承認した全社的な情報管理規程が定められており、従業員等がいつでも閲覧できる形で周知されている。" },
              { score: 4, text: "情報管理規程は、担当部署または担当者によって定期的に見直し・更新が行われ、常に最新の状態が維持されている。" },
              { score: 5, text: "経営層が主導する部門横断的な体制（情報セキュリティ委員会など）が構築され、事業戦略との整合性を図りながら、規程の評価・見直しを継続的に実施している。" }
            ],
            // ★ このリスク情報を追加
            risk: "規程が未策定のため、情報管理の判断基準が属人化し、一貫性のない対応になるリスクがあります。"
          },
          // ... 他の質問にも同様にriskプロパティを追加
        ]
      }
    ]
  },
];

function App() {
  return (
    <div>
      <SurveyForm surveyData={newStructuredSurveyData} />
    </div>
  );
}

export default App;