CREATE TABLE [AIAdvice_CHU$] (
    [回答者番号] NVARCHAR(100) NOT NULL,
    [中項目番号] NVARCHAR(50) NOT NULL,
    [average_score] DECIMAL(5, 2) NULL, -- 中項目毎の平均スコアを格納 (例: 3.75)
    [is_applicable] BIT NOT NULL DEFAULT 1, -- 評価対象か否か (1: 該当する, 0: 該当しない)
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