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

let currentAccessData = null;

async function generateAccess(id, fio) {
    try {
        const res = await fetch(`/driver/generate-credentials/${id}`, { method: 'POST' });
        if (!res.ok) {
            throw new Error(`HTTP error ${res.status}`);
        }
        const data = await res.json();
        if (data.success) {
            const driverId = data.driverId || id;
            const driverFio = data.fio || fio;
            const apkUrl = `${location.origin}/download-apk`;

            currentAccessData = {
                id: driverId,
                fio: driverFio,
                login: data.login,
                password: data.password,
                apkUrl: apkUrl
            };

            const fullText = `🚗 Доступ в мобильное приложение LUNA 2000\n\n` +
                `Водитель: ${driverFio}\n\n` +
                `1️⃣ Скачайте приложение:\n${apkUrl}\n\n` +
                `2️⃣ Ваш ID код для входа:\n${driverId}\n\n` +
                `(В приложении введите этот ID код или отсканируйте QR-код и нажмите «Войти»)`;

            currentAccessData.fullText = fullText;

            // Сразу копируем ID код в буфер
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(driverId);
                } catch (clipErr) {
                    console.warn('Clipboard write error:', clipErr);
                }
            }

            // Заполняем модальное окно
            const fioEl = document.getElementById('accessModalFio');
            const idEl = document.getElementById('accessModalDriverId');
            const qrEl = document.getElementById('accessModalQr');
            const loginEl = document.getElementById('accessModalWebLogin');
            const pwdEl = document.getElementById('accessModalWebPassword');
            const modal = document.getElementById('driverAccessModal');

            if (fioEl) fioEl.textContent = driverFio;
            if (idEl) idEl.textContent = driverId;
            if (loginEl) loginEl.textContent = data.login || '—';
            if (pwdEl) pwdEl.textContent = data.password || '—';
            if (qrEl) {
                qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(driverId)}`;
            }

            if (modal) {
                modal.classList.add('is-active');
                showCopyToast('ID код скопирован в буфер!');
            } else {
                alert(`📱 ID код для приложения водителя ${driverFio}:\n\n${driverId}\n\n(ID скопирован в буфер обмена)`);
            }
        } else {
            alert('Ошибка генерации доступа');
        }
    } catch (e) {
        console.error(e);
        alert('Ошибка: ' + e.message);
    }
}

function closeAccessModal() {
    const modal = document.getElementById('driverAccessModal');
    if (modal) modal.classList.remove('is-active');
}

function copyDriverIdOnly() {
    if (!currentAccessData?.id) return;
    navigator.clipboard.writeText(currentAccessData.id).then(() => {
        showCopyToast('ID код скопирован!');
    });
}

function copyDriverFullMessage() {
    if (!currentAccessData?.fullText) return;
    navigator.clipboard.writeText(currentAccessData.fullText).then(() => {
        showCopyToast('Сообщение скопировано!');
    });
}

function showCopyToast(msg) {
    const toast = document.getElementById('accessCopyToast');
    if (toast) {
        toast.innerHTML = `<i class="fas fa-check-circle mr-1"></i>${msg}`;
        toast.style.display = 'inline-block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
}