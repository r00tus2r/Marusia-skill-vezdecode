const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const config = require('./config')

const port = 8888;

const app = express();

const sendResponse = (text, session, session_state = {}, TTStext = text, end_session = false, card = []) => {
    return {
        "response": {
            "text": text,
            "tts": TTStext,
            "commands": card,
            "end_session": end_session,
        },
        "session": {
            ...session,
            "skill_id": "dd2433ef-16a4-4e9c-9321-eb873504cb5b"
        },
        "session_state": session_state,
        "version": "1.0"
      }
} 

function log(message, noScreen) {
    console.log(`INFO | Обработана команда ${message} | NoScreen: ${noScreen}`)
}

Array.prototype.contains = function(target) {
    return this.some( obj => target.includes(obj) );
};

const command_name = 'goose' // Название команды, которое нужно для первого задания
const skill_name = 'тестовый скилл' // Название скилла, чтобы детектил когда его запускают

const vezdecodeNames = ['вездекод', 'вездеход'] // Маруся любит слышать "Вездекод" как "ВездеХод", поэтому вот такие пироги

const questions = config.questions // Загружаем вопросы

app.use(bodyParser.json());
app.use(cors());
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);

app.post('/marusia-webhook', async (res, req) => {
    
    const request = res.body

    const command = request.request.command // Текст команды
    const session = request.session // Сессия
    const wordsArray = request.request.nlu.tokens // Массив слов который маруся шлет в каждом запросе

    const noScreenMode = request.meta.interfaces.screen == undefined

    log(command, noScreenMode)

    if(wordsArray.contains(skill_name.slice(' '))) {
        return req.send(sendResponse('Спасибо что запустили меня! Чтобы узнать команды, скажите "Помощь"', session))
    }

    if(['привет', 'начать'].includes(command)) {
        return req.send(sendResponse('Привет! Я - скилл-решение заданий для Вездекода. Доступные команды ты можешь узнать, сказав \"Помощь\"', session))
    }

    if(wordsArray.contains(['выйди', 'выход', 'выйти', 'замолчи', 'хватит', 'остановись'])) {
        return req.send(sendResponse('Работа навыка завершена!', session, {}, 'Работа навыка завершена! До скорых встреч!', true))
    }

    if(['помощь', 'помоги', 'помогите', 'команды', 'доступные команды', 'команд'].includes(command)) {

        const tts = noScreenMode ? `Доступные команды --- Команда "Вездекод, ${command_name}" -- Ответит "Привет Вездек+одерам!" -- Команда - "Викторина" -- Задаст восемь вопросов про айт+и и порекомендует категорию вездекода` : 'Список доступных команд отправлен в диалог'

        return req.send(sendResponse(`Доступные команды: \n\n\"Вездекод, ${command_name}\" - Ответит \"Привет Вездекодерам!\"\n\n\"Викторина\" - Задаст 8 вопросов про IT и порекомендует категорию`, session, {}, tts))
    }

    if(wordsArray.contains(vezdecodeNames) && wordsArray.includes(command_name)) {
        return req.send(sendResponse('Привет Вездекодерам!', session, {}, 'Привет Вездек+одерам!'))
    }

    if(['викторина', 'вопросы', 'опрос', 'викторину'].includes(command)) {
        return req.send(sendResponse(`Начнём опрос! Все ответы отправляй только в формате \"Ответ [Номер варианта ответа]\"\n\nПервый вопрос:\n${questions[0].question}\n\n${questions[0].answers}`, session, {
            "question": 0,
            "score": {
                "Java, Mobile": 0,
                "Back End": 0,
                "VK Mini Apps": 0,
                "PHP": 0
            }
        }, `Начнём опрос! Все ответы отправляй только в формате \"Ответ [Номер варианта ответа]\"\n\nПервый вопрос:\n${questions[0].tts}`))
    }

    if(['ответ', 'вариант', 'номер', '1', '2', '3', 'один', 'два', 'три', 'первый', 'второй', 'третий', 'первое', 'второе', 'третье'].includes(wordsArray[0])) {
        if(request?.state?.session?.question === undefined) {
            return req.send(sendResponse('Вы не проходите викторину.\nЧтобы начать, отправьте слово "Викторина"', session, {}, 'Вы не прох+одите викторину.\nЧтобы начать, отправьте слово "Викторина"'))
        }

        let answer = wordsArray[1] || wordsArray[0] // На случай если человек назвал только цифру ответа

        if(isNaN(answer)) {
            answer = config.textNumbers[answer] // Пробуем преобразовать текстовое число в обычное
        }

        const questionData = questions[request.state.session.question]
        const isCorrect = answer == questionData.correctAnswer
        let session_state = request.state.session

        if(isCorrect) {
            session_state.score[questionData.group]++
        }

        session_state.question++

        if(session_state.question == questions.length) {
            const winGroup = Object.entries(session_state.score).reduce((max, n) => n[1] > max[1] ? n : max).join(': ')

            return req.send(sendResponse(`Вопросы окончены! Больше всего баллов Вы набрали в категории ${winGroup}\n\nСоветуем обратить на неё внимание при участии в Вездекоде!`, session, {}, `${config.finishSound} Вопросы окончены! Больше всего баллов Вы набрали в категории ^${winGroup}^\n\nСоветуем обратить на неё внимание при участии в Вездекоде!`, false, 
            [{
                "type": "MiniApp",
                "url": "https://vk.com/app7923597",
            },
            {
                "type": "BigImage",
                "image_id": 457239019
            }]))
        }

        return req.send(sendResponse(`${isCorrect ? 'Верно!' : 'Не верно!'}\nСледующий вопрос:\n\n${questions[session_state.question].question}\n\n${questions[session_state.question].answers}`, session, session_state, `${isCorrect ? `${config.successSound}  Верно!` : `${config.errorSound} Не верно!`}\nСледующий вопрос: ${questions[session_state.question].tts}`, false, 
        [{
            "type":"BigImage",
            "image_id": isCorrect ? 457239017 : 457239018
        }]))
    }

    return req.send(sendResponse('Ахтунг! Неизвестная команда!\nСписок доступных команд можно получить, сказав \"Помощь\"\n\nЧтобы выйти из скилла, скажите "Выход"', session))

});



app.listen(port, () => console.log(`PORT ${port} | Сервер скилла запущен`));