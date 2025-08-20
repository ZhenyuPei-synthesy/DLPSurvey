
import React, { useState } from 'react';

function SurveyForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [satisfaction, setSatisfaction] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = {
      name,
      email,
      satisfaction,
      reason: satisfaction <= 3 ? reason : ''
    };
    console.log('Submitted:', formData);
    alert('アンケートを送信しました！');
  };

  return (
    <div style={{ maxWidth: '500px', margin: 'auto' }}>
      <h2>サービスアンケート</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>名前:</label><br />
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label>メールアドレス:</label><br />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label>サービス満足度 (1〜5):</label><br />
          <select value={satisfaction} onChange={(e) => setSatisfaction(Number(e.target.value))} required>
            <option value="">選択してください</option>
            {[1,2,3,4,5].map(num => <option key={num} value={num}>{num}</option>)}
          </select>
        </div>
        {satisfaction <= 3 && (
          <div>
            <label>不満の理由:</label><br />
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        <button type="submit">送信</button>
      </form>
    </div>
  );
}

export default SurveyForm;
