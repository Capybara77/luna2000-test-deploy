namespace luna2000.Utils;

public static class UserHelper
{
    private static readonly Dictionary<char, string> TranslitMap = new()
    {
        {'а',"a"},{'б',"b"},{'в',"v"},{'г',"g"},{'д',"d"},{'е',"e"},{'ё',"yo"},
        {'ж',"zh"},{'з',"z"},{'и',"i"},{'й',"y"},{'к',"k"},{'л',"l"},{'м',"m"},
        {'н',"n"},{'о',"o"},{'п',"p"},{'р',"r"},{'с',"s"},{'т',"t"},{'у',"u"},
        {'ф',"f"},{'х',"kh"},{'ц',"ts"},{'ч',"ch"},{'ш',"sh"},{'щ',"shch"},
        {'ъ',""},{'ы',"y"},{'ь',""},{'э',"e"},{'ю',"yu"},{'я',"ya"},
        {'А',"a"},{'Б',"b"},{'В',"v"},{'Г',"g"},{'Д',"d"},{'Е',"e"},{'Ё',"yo"},
        {'Ж',"zh"},{'З',"z"},{'И',"i"},{'Й',"y"},{'К',"k"},{'Л',"l"},{'М',"m"},
        {'Н',"n"},{'О',"o"},{'П',"p"},{'Р',"r"},{'С',"s"},{'Т',"t"},{'У',"u"},
        {'Ф',"f"},{'Х',"kh"},{'Ц',"ts"},{'Ч',"ch"},{'Ш',"sh"},{'Щ',"shch"},
        {'Ъ',""},{'Ы',"y"},{'Ь',""},{'Э',"e"},{'Ю',"yu"},{'Я',"ya"}
    };

    /// <summary>
    /// Генерирует логин из ФИО.
    /// "Иванов Иван Иванович" → "ivanov.ivan"
    /// </summary>
    public static string GenerateLogin(string fio)
    {
        var parts = fio.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var lastName  = parts.Length > 0 ? Transliterate(parts[0]) : "user";
        var firstName = parts.Length > 1 ? Transliterate(parts[1]) : "";

        var login = string.IsNullOrEmpty(firstName)
            ? lastName
            : $"{lastName}.{firstName}";

        return login.ToLowerInvariant();
    }

    /// <summary>Генерирует случайный пароль из 10 символов</summary>
    public static string GeneratePassword()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        var rng = new Random();
        return new string(Enumerable.Range(0, 10).Select(_ => chars[rng.Next(chars.Length)]).ToArray());
    }

    private static string Transliterate(string text)
    {
        var result = new System.Text.StringBuilder();
        foreach (var ch in text)
        {
            if (TranslitMap.TryGetValue(ch, out var tr))
                result.Append(tr);
            else if (char.IsLetterOrDigit(ch) || ch == '_' || ch == '.')
                result.Append(char.ToLowerInvariant(ch));
        }
        return result.ToString();
    }
}
