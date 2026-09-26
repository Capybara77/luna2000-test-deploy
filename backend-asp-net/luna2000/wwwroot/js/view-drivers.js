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

async function generateAccess(id, fio) {
    if (!confirm(`Сгенерировать доступ для "${fio}"?\nБудет создан (или обновлён) логин и пароль.`)) return;
    try {
        const res = await fetch(`/driver/generate-credentials/${id}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            const text = `✅ Доступ для ${fio}\n\nЛогин: ${data.login}\nПароль: ${data.password}\n\nСайт: ${location.origin}/login`;
            navigator.clipboard.writeText(text);
            alert(text + '\n\n(скопировано в буфер)');
        } else {
            alert('Ошибка генерации доступа');
        }
    } catch (e) {
        console.error(e);
        alert('Ошибка: ' + e.message);
    }
}