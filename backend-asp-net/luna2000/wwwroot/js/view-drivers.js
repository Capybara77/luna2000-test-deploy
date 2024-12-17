function editDriver(id) {
  window.location.href = `driver/edit?id=${id}`;
}

function deleteDriver(id) {
  if (confirm("Вы уверены, что хотите удалить этого водителя?")) {
    fetch(`/driver/delete/${id}`, { method: "DELETE" })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert("Водитель успешно удален!");
          location.reload(); // Перезагрузить страницу, чтобы обновить список
        } else {
          alert("Ошибка при удалении водителя.");
        }
      })
      .catch((error) => console.error("Ошибка при удалении водителя:", error));
  }
}

function createUrl(id) {
    fetch(`/driver/createtgurl/${id}`, { method: "GET" })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                navigator.clipboard.writeText(data.url);
                alert("Ссылка скопирована в буфер обмена");
            } else {
                alert("Ошибка");
            }
        })
        .catch((error) => console.error("Ошибка:", error));
}