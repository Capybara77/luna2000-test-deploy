document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    })
        .then((response) => {
            if (response.status === 404) {
                document.getElementById("error").style.display = "block";
                return null;
            }
            return response.json();
        })
        .then((data) => {
            if (!data) return;
            if (data.success) {
                // Редирект по роли (сервер возвращает redirect)
                window.location.replace(data.redirect || "/");
            } else {
                document.getElementById("error").style.display = "block";
            }
        })
        .catch((error) => {
            console.error("Error:", error);
        });
});
