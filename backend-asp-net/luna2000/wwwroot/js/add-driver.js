document
    .getElementById("addDriverForm")
    .addEventListener("submit", function (event) {
        event.preventDefault();

        const formData = new FormData();
        formData.append(
            "id",
            Math.floor(Math.random() * (300000 - 200000 + 1)) + 200000
        );
        formData.append("fio", document.getElementById("fio").value);
        formData.append("balance", document.getElementById("balance").value);
        formData.append("passport", document.getElementById("passport").value);
        formData.append(
            "registration",
            document.getElementById("registration").value
        );
        formData.append("address", document.getElementById("address").value);
        formData.append(
            "driverLicense",
            document.getElementById("driverLicense").value
        );
        formData.append(
            "parkingAddress",
            document.getElementById("parkingAddress").value
        );
        formData.append("contacts", document.getElementById("contacts").value);
        formData.append("note", document.getElementById("note").value);

        const photoFiles = document.getElementById("photos").files;
        for (let i = 0; i < photoFiles.length; i++) {
            formData.append("photos", photoFiles[i]);
        }

        fetch("/driver/add", {
            method: "POST",
            body: formData,
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    alert("Водитель успешно добавлен!");
                    window.location.href = "/driver"; // Редирект на страницу с водителями
                } else {
                    alert("Ошибка при добавлении водителя.");
                }
            })
            .catch((error) => {
                console.error("Ошибка:", error);
                alert("Ошибка при добавлении водителя.");
            });
    });
