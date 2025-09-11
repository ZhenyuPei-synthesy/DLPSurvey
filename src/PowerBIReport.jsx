import React from 'react';

const PowerBIReport = ({ onBack }) => {
  // 重要: このURLを実際のPower BIレポートの埋め込みURLに置き換えてください。
  const powerBiEmbedUrl = "https://app.powerbi.com/reportEmbed?reportId=43b53f23-1e93-4849-80aa-152608934985&autoAuth=true&ctid=2db96b99-3928-488f-9022-2fe14b729cee";

  return (
    <div className="p-4 sm:p-8 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Power BI ダッシュボード</h2>
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            戻る
          </button>
        </div>
        <div className="border rounded-lg shadow-sm bg-white" style={{ height: 'calc(100vh - 22rem)' }}>
          <iframe
            title="Power BI Report"
            width="100%"
            height="100%"
            src={powerBiEmbedUrl}
            frameBorder="0"
            allowFullScreen={true}
          ></iframe>
        </div>
        <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-700">
          <p>
            <strong>注:</strong> これは埋め込みPower BIレポートのサンプルです。実際のレポートを表示するには、<code>src/PowerBIReport.jsx</code> ファイル内の <code>powerBiEmbedUrl</code> 変数を、お使いのPower BIレポートの公開URLまたは埋め込みURLに置き換えてください。
          </p>
        </div>
      </div>
    </div>
  );
};

export default PowerBIReport;
