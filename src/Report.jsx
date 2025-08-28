import React from 'react';

const RadarPlaceholder = () => (
  <div className="flex items-center justify-center w-full h-64 bg-white border border-gray-200 rounded-lg shadow-sm">
    <div className="text-slate-400">レーダーチャート（プレースホルダ）</div>
  </div>
);

const ScoreList = ({ categories }) => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <h3 className="text-lg font-semibold mb-4">大項目別 平均スコア</h3>
    <ul className="space-y-4">
      {categories.map((c, i) => (
        <li key={i} className="flex justify-between items-center">
          <span className="text-slate-700">{c.name}</span>
          <span className={`font-bold ${typeof c.score === 'number' && c.score >= 4 ? 'text-green-600' : 'text-red-600'}`}>{c.score ?? '-'}</span>
        </li>
      ))}
    </ul>
  </div>
);

const MidComments = ({ sections }) => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold">中項目別 総評コメント</h2>
    {sections.map((sec, i) => (
      <div key={i}>
        <h3 className="text-lg font-semibold mb-3">{i + 1}. {sec.title}</h3>
        <div className="space-y-3">
          {sec.subsections.map((sub, j) => (
            <div key={j} className={`p-4 rounded-md ${sub.highlight ? 'bg-green-50' : 'bg-gray-100'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{sub.title}</div>
                  <div className="text-sm text-slate-600 mt-1">{sub.comment || 'この項目は評価されていません。'}</div>
                </div>
                <div className="text-green-600 font-bold">{sub.score ?? '-'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const DetailsTable = ({ rows }) => (
  <div className="mt-10">
    <h2 className="text-2xl font-bold mb-4">詳細評価シート</h2>
    <div className="overflow-x-auto bg-white border rounded-lg shadow-sm">
      <table className="min-w-full table-auto">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left">項目</th>
            <th className="px-4 py-3">評価点</th>
            <th className="px-4 py-3">コメント</th>
            <th className="px-4 py-3">改善策</th>
            <th className="px-4 py-3">関連法規</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 text-sm text-slate-700">{r.item}</td>
              <td className="px-4 py-3 text-center text-green-600 font-bold">{r.score ?? '未評価'}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{r.comment ?? '-'}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{r.action ?? '-'}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{r.law ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const Report = ({ data }) => {
  // Minimal static fallback data for UI-only view
  const categories = data?.categories || [
    { name: '全社的・組織的管理', score: 5.0 },
    { name: '人的管理', score: 0.0 },
    { name: '物理的管理', score: 0.0 },
    { name: '技術的・IT管理', score: 0.0 },
    { name: 'サプライチェーン・外部連携管理', score: 0.0 },
  ];

  const sections = data?.sections || [
    {
      title: '全社的・組織的管理',
      subsections: [
        { title: '1.1. 方針とガバナンス', comment: '非常によく管理されています。現在の高い水準を維持してください。', score: 5.0, highlight: true },
        { title: '1.2. 情報の特定と分類', comment: null, score: null, highlight: false },
      ],
    },
    {
      title: '人的管理',
      subsections: [
        { title: '2.1. 採用・入社時', comment: null, score: null },
        { title: '2.2. 在職中', comment: null, score: null },
      ],
    },
  ];

  const rows = data?.rows || [
    { item: '1. 全社的な情報管理規程が策定され、経営層によって承認されているか。', score: '未評価', comment: '-', action: '-', law: 'ハンドブック: 第3章 3-3 (p.28-29)' },
    { item: '2. 営業秘密を管理・統括する責任部門が明確に定められているか。', score: 5, comment: '-', action: '現状維持', law: 'ハンドブック: 第4章 (p.115-)' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-extrabold">機密情報管理 評価チェックリスト</h1>
          <p className="text-slate-600 mt-2">自社の情報管理体制を評価し、改善点を見つけましょう。</p>
        </header>

        <section className="bg-white p-6 rounded-lg shadow-sm mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <RadarPlaceholder />
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <span className="inline-block w-5 h-3 border border-indigo-400 bg-indigo-100" />
              <span>平均スコア</span>
            </div>
          </div>
          <div>
            <ScoreList categories={categories} />
          </div>
        </section>

        <section className="mb-8">
          <MidComments sections={sections} />
        </section>

        <section>
          <DetailsTable rows={rows} />
        </section>
      </div>
    </div>
  );
};

export default Report;
