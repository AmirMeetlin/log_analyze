const { Client } = require('@elastic/elasticsearch');
const axios = require('axios');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

// 1. Настройка подключения к Elasticsearch с авторизацией
const client = new Client({
  node: 'https://your-elasticsearch-server:9200', // Замените на ваш адрес
  auth: {
    username: 'your-username',
    password: 'your-password'
  }
});

// 2. Функция загрузки файла с подстроками из GitLab
async function loadIdentifiersFromGitLab() {
  const url = 'https://gitlab.com/your-repo/raw/main/log_identifiers.json'; // Замените на реальный URL
  const response = await axios.get(url, {
    headers: { 'PRIVATE-TOKEN': 'your-access-token' } // Токен доступа для приватного репозитория
  });
  return response.data;
}

// 3. Функция получения логов из Elasticsearch
async function fetchLogs() {
  const { body } = await client.search({
    index: 'your-log-index', // Замените на ваш индекс
    body: {
      query: {
        match_all: {} // Можно настроить запрос под ваши нужды
      }
    }
  });
  return body.hits.hits;
}

// 4. Функция анализа логов на наличие подстрок
function analyzeLog(log, identifiers) {
  const logMessage = log._source.message; // Замените на соответствующее поле

  for (const [type, substrings] of Object.entries(identifiers.error_types)) {
    for (const substring of substrings) {
      if (logMessage.includes(substring)) {
        return { type, logMessage };
      }
    }
  }
  return null;
}

// 5. Функция отправки email-уведомления
async function sendEmail(subject, text) {
  let transporter = nodemailer.createTransport({
    host: 'smtp.your-email.com',
    port: 587,
    secure: false,
    auth: {
      user: 'your-email@example.com',
      pass: 'your-password'
    }
  });

  let info = await transporter.sendMail({
    from: '"Log Monitor" <your-email@example.com>',
    to: 'recipient@example.com',
    subject: subject,
    text: text
  });

  console.log('Message sent: %s', info.messageId);
}

// 6. Основной процесс анализа логов
async function processLogs() {
  const identifiers = await loadIdentifiersFromGitLab(); // Загрузка подстрок
  const logs = await fetchLogs(); // Получение логов из Elasticsearch

  for (const log of logs) {
    const result = analyzeLog(log, identifiers);
    if (result) {
      await sendEmail(`New Error Detected: ${result.type}`, `Log Message: ${result.logMessage}`);
    }
  }
}

// 7. Настройка cron-задачи для выполнения анализа каждые 5 минут
cron.schedule('*/5 * * * *', () => {
  console.log('Running log analysis');
  processLogs();
});

// Запуск первого анализа при старте приложения
processLogs();
