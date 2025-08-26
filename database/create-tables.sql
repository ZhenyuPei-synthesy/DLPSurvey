-- Azure SQL Database用のテーブル作成スクリプト

-- 回答保存用テーブル
CREATE TABLE SurveyAnswers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ItemId NVARCHAR(100) NOT NULL,
    Score INT NULL,
    Comment NVARCHAR(MAX) NULL,
    SubmissionDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    INDEX IX_SurveyAnswers_SubmissionDate (SubmissionDate),
    INDEX IX_SurveyAnswers_ItemId (ItemId)
);

-- 元のサーベイデータテーブル（既存の場合はスキップ）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Servey$')
BEGIN
    CREATE TABLE [Servey$] (
        [大項目] NVARCHAR(255),
        [中項目] NVARCHAR(255),
        [チェック項目] NVARCHAR(MAX),
        [対策評価] NVARCHAR(MAX),
        [リスク] NVARCHAR(MAX)
    );
END;
