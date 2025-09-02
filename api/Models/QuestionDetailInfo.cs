using System.Collections.Generic;

namespace Company.Function.Models
{
    public class QuestionDetailInfo
    {
        public int QuestionId { get; set; }
        public string QuestionText { get; set; } = string.Empty;
        public string QuestionType { get; set; } = string.Empty;
        public List<OptionInfo> AllOptions { get; set; } = new List<OptionInfo>();
        public SelectedOptionInfo? SelectedOption { get; set; }
        public string? UserReason { get; set; }
        public string? UserComment { get; set; }
    }

    public class OptionInfo
    {
        public string OptionText { get; set; } = string.Empty;
        public int Score { get; set; }
        public bool IsSelected { get; set; }
        public string? Description { get; set; }
    }

    public class SelectedOptionInfo
    {
        public string OptionText { get; set; } = string.Empty;
        public int Score { get; set; }
        public string? Description { get; set; }
    }

    public class SubcategoryEvaluationPayload
    {
        public string RespondentId { get; set; } = string.Empty;
        public string SubcategoryId { get; set; } = string.Empty;
        public List<QuestionResponse> Questions { get; set; } = new List<QuestionResponse>();
        public string? UserComment { get; set; }
    }

    public class QuestionResponse
    {
        public int QuestionId { get; set; }
        public string QuestionText { get; set; } = string.Empty;
        public string SelectedOptionText { get; set; } = string.Empty;
        public int Score { get; set; }
        public string? Reason { get; set; }
        public string? Comment { get; set; }
    }

    public class SubcategoryTemplate
    {
        public string SubcategoryId { get; set; } = string.Empty;
        public string SubcategoryName { get; set; } = string.Empty;
        public string IdealState { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public class SurveyQuestion
    {
        public int QuestionId { get; set; }
        public string QuestionNumber { get; set; } = string.Empty;
        public string ChuItemNumber { get; set; } = string.Empty;
        public string QuestionText { get; set; } = string.Empty;
        public string? QuestionType { get; set; }
        public string? Risk { get; set; }
        public string? RelatedRegulations { get; set; }
    }

    public class SurveyOption
    {
        public int OptionId { get; set; }
        public int QuestionId { get; set; }
        public string OptionText { get; set; } = string.Empty;
        public int Score { get; set; }
        public int OptionOrder { get; set; }
        public string? Description { get; set; }
    }
}
