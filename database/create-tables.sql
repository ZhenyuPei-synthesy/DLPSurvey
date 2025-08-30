-- create-tables.sql
-- AI中項目評価テーブル（AI評価機能用）
-- このテーブルは中項目ごとのAI評価結果を保存します

CREATE TABLE [AIAdvice_CHU$] (
    [回答者番号] NVARCHAR(100) NOT NULL,
    [中項目番号] NVARCHAR(50) NOT NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, evaluating, completed, error
    [evaluation_text] NTEXT NULL,
    [recommendation_text] NTEXT NULL,
    [created_at] DATETIME2 DEFAULT GETDATE(),
    [updated_at] DATETIME2 DEFAULT GETDATE(),
    PRIMARY KEY ([回答者番号], [中項目番号])
);

-- インデックス追加（検索性能向上のため）
CREATE INDEX IX_AIAdvice_CHU_Status ON [AIAdvice_CHU$] ([status]);
CREATE INDEX IX_AIAdvice_CHU_CreatedAt ON [AIAdvice_CHU$] ([created_at]);
