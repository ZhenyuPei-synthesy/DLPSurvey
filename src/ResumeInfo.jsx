import React from 'react';

const ResumeInfo = ({ email, answerNumber, onBack }) => {
  return (
    <div className="bg-slate-50 font-sans flex items-center justify-center p-6 h-full">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">一時保存が完了しました</h2>
        <p className="text-slate-600 mb-4">アンケートの途中保存方法を以下にご案内します。再開する際は保存したメールアドレスと回答番号を入力してください。</p>

        <div className="text-left bg-gray-50 p-4 rounded mb-4">
          <p className="text-sm text-slate-700">登録メールアドレス</p>
          <p className="font-medium">{email || <span className="text-gray-400">（未保存）</span>}</p>

          <div className="mt-3">
            <p className="text-sm text-slate-700">回答番号（大切に保管してください）</p>
            <p className="font-mono text-lg">{answerNumber || <span className="text-gray-400">（未保存）</span>}</p>
            <p className="text-xs text-slate-500 mt-1">回答番号は再開時に必要です。メモをお取りください。</p>
          </div>
        </div>

        <p className="text-sm text-slate-700 mb-4">保存情報を用意できたら、最初の画面に戻って「アセスメント再開」ボタンから情報を入力してください。</p>

        <div className="flex justify-center gap-4">
          <button onClick={onBack} className="px-4 py-2 bg-blue-600 text-white rounded">トップへ戻る</button>
        </div>
      </div>
    </div>
  );
};

export default ResumeInfo;
