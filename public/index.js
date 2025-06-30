const seperator = "----" + "----" + "----" + "----";

function isScrolledToBottom(element) {
    return Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) <= 1;
}

async function main() {
    console.log("loaded");
    /**
     * @type { HTMLButtonElement }
     */
    const loginButton = document.getElementById("login-button");
    /**
     * @type { HTMLButtonElement }
     */
    const logoutButton = document.getElementById("logout-button");
    /**
     * @type { HTMLInputElement }
     */
    const usernameInput = document.getElementById("username-input");
    const outputDiv = document.getElementById("output");
    /**
 * @type { HTMLInputElement }
 */
    const messageInput = document.getElementById("message-input");
    /**
     * @type { HTMLButtonElement }
     */
    const sendButton = document.getElementById("send-button");
    /**
     * @type { HTMLButtonElement }
     */
    const listPlayerButton = document.getElementById("list-player-button");

    let alive = false;

    async function updateStatus() {
        loginButton.disabled = alive;
        logoutButton.disabled = !alive;
        sendButton.disabled = !alive;
        listPlayerButton.disabled = !alive;
    }

    /**
     * 
     * @param { string | HTMLElement } content 
     */
    function output(content) {
        const scrolledToBottom = isScrolledToBottom(outputDiv);
        if (typeof (content) === "string") {
            const contentElement = document.createElement("div");
            contentElement.textContent = content;
            contentElement.className = "default";
            outputDiv.appendChild(contentElement);
        } else {
            outputDiv.appendChild(content);
        }
        if (scrolledToBottom) outputDiv.scrollTop = outputDiv.scrollHeight - outputDiv.clientHeight;
    }

    /**
     * 
     * @param { string } content 
     */
    function outputError(content) {
        const element = document.createElement("div");
        element.className = "error";
        element.textContent = content;
        output(element);
    }

    async function logout() {
        try {
            const result = await fetch("/stop", {
                method: "POST"
            });
            if (result.status !== 200) {
                return outputError(`错误, 服务器提示: ${(await result.json()).message}`);
            }
            output(`IRC客户端成功关闭.`);
        } catch (e) {
            console.error(e);
            return outputError(`发生错误: ${e}`);
        }
    }

    async function login() {
        const username = usernameInput.value;
        if (username.trim() === "") return outputError("用户名不能为空!");
        try {
            const result = await fetch("/start", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username
                })
            });
            if (result.status !== 200) {
                return outputError(`错误, 服务器提示: ${(await result.json()).message}`);
            }
            output(`IRC客户端成功开启.`);
        } catch (e) {
            console.error(e);
            return outputError(`发生错误: ${e}`);
        }
    }

    sendButton.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const message = messageInput.value;
        messageInput.value = "";
        console.log("send");
        try {
            const result = await fetch("/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: message
                })
            });
            const body = await result.json();
            if (result.status !== 200) {
                return outputError(`错误, 服务器提示: ${body.message}`);
            }
        } catch (e) {
            console.error(e);
            return outputError(`发生错误: ${e}`);
        }
    });

    loginButton.addEventListener("click", async () => {
        await login();
        await updateStatus();
    });
    logoutButton.addEventListener("click", async () => {
        await logout();
        await updateStatus();
    });

    function createListPlayerSeperator() {
        const seperatorElement = document.createElement("div");
        seperatorElement.className = "seperator";
        seperatorElement.textContent = seperator;
        return seperatorElement;
    }


    function createPlayerSeperator() {
        const seperatorElement = document.createElement("div");
        seperatorElement.className = "seperator";
        seperatorElement.textContent = ", ";
        return seperatorElement;
    }


    listPlayerButton.addEventListener("click", async () => {
        try {
            const res = await fetch("/getPlayerList");
            const body = await res.json();
            if (res.status !== 200) {
                return outputError(`错误, 服务器提示: ${body.message}`);
            }
            const result = Array.from(new Set(body.result));
            const nodes = [];

            nodes.push(createListPlayerSeperator());

            while (result.length > 0) {
                const players = result.slice(0, 3).filter(name => name.trim() !== "");
                result.splice(0, 3);
                const messageElement = document.createElement("div");
                messageElement.className = "messageDiv";

                const messageNodes = [];

                players.forEach((player, index) => {
                    const playerElement = document.createElement("div");
                    playerElement.className = "player";
                    playerElement.textContent = player;
                    messageNodes.push(playerElement);
                    if (index < players.length - 1) {
                        console.log(index, players, players.length);
                        messageNodes.push(createPlayerSeperator());
                    }

                    const messageElement = document.createElement("div");
                    messageElement.className = "messageDiv";
                    messageNodes.forEach((node) => messageElement.appendChild(node));
                });
                messageNodes.forEach(node => messageElement.appendChild(node));
                nodes.push(messageElement);
            }

            nodes.push(createListPlayerSeperator());
            nodes.forEach(node => output(node));

        } catch (e) {
            console.error(e);
            return outputError(`发生错误: ${e}`);
        }

    });

    await updateStatus();

    setInterval(async () => {
        const newAlive = (await (await fetch("/isAlive")).json()).result;
        if (alive && !newAlive) output("IRC客户端停止运行.");
        alive = newAlive;
        await updateStatus();
    }, 200);

    setInterval(async () => {
        try {
            const result = await fetch("/fetchMessages");
            if (result.status !== 200) {
                return outputError(`拉取消息错误, 服务器提示: ${(await result.json()).message}`);
            }

            const messages = (await result.json()).result;
            messages.forEach(message => {
                const nodes = [];

                const playerElement = document.createElement("div");
                playerElement.className = "player";
                playerElement.textContent = message.player;
                nodes.push(playerElement);

                if (message.type === "message") {
                    const seperatorElement = document.createElement("div");
                    seperatorElement.className = "seperator";
                    seperatorElement.textContent = ">";
                    nodes.push(seperatorElement);

                    const messageElement = document.createElement("div");
                    messageElement.className = "content";
                    console.log(message);
                    messageElement.textContent = message.message;
                    nodes.push(messageElement);
                } else {
                    const playerActivityElement = document.createElement("div");
                    playerActivityElement.className = message.type === "playerJoin" ? "join" : "leave";
                    playerActivityElement.textContent = message.type === "playerJoin" ? "加入了." : "离开了.";
                    nodes.push(playerActivityElement);
                }

                const element = document.createElement("div");
                element.className = "messageDiv";
                nodes.forEach(node => element.appendChild(node));

                output(element);
            });
        } catch (e) {
            console.error(e);
            return outputError(`拉取消息发生错误: ${e}`);
        }
    }, 200);
}

window.addEventListener("load", () => main());