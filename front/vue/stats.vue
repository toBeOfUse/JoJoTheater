<template>
    <div v-if="!authorized">
        <input type="password" v-model="password" @keypress.enter="authorize" />
        <button @click="authorize">Authorize</button>
    </div>
    <template v-else>
        <table>
            <thead>
                <tr>
                    <th scope="col">Uptime</th>
                    <th scope="col">Name in chat</th>
                    <th scope="col">Reported player state</th>
                    <th scope="col">Latest ping</th>
                    <th scope="col">Average ping</th>
                    <!-- <th scope="col">Ping distribution</th> -->
                    <th scope="col">Approx. location</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(conn, i) in players" :key="i">
                    <td>{{ msToS(conn.uptimeMs) }} seconds</td>
                    <td>{{ conn.chatName || "not logged in" }}</td>
                    <td style="text-align: left; font-size: small">
                        <template v-if="conn.playerState">
                            Playing: {{ conn.playerState.playing }}<br />
                            Current Time:
                            {{ msToHMS(conn.playerState.currentTimeMs) }}<br />
                            Video: {{ conn.playerState.video.title }}<br />
                            Last Update Time:
                            {{ conn.playerState.receivedTimeISO }}
                        </template>
                    </td>
                    <td>{{ conn.latestPing }} ms</td>
                    <td>{{ Math.round(conn.avgPing) }} ms</td>
                    <!-- <td>
                    <canvas
                        width="160"
                        height="100"
                        id="charti"
                    ></canvas>
                </td> -->
                    <td>{{ conn.location }}</td>
                </tr>
            </tbody>
        </table>
        <p>
            Current server state: Playing: {{ server.playing }}, current time:
            {{ msToHMS(server.currentTimeMs) }}, current video:
            {{ server.video.title }}
        </p>
    </template>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import type { ConnectionStatus } from "../../types";

export default defineComponent({
    setup() {
        const players = ref<ConnectionStatus[]>([]);
        const server = ref<ConnectionStatus | null>(null);
        const authorized = ref(false);
        const storedPassword = localStorage.getItem("password");
        const password = ref(storedPassword ?? "");
        const authorize = () => {
            fetch("/api/stats", { headers: { Authorization: password.value } })
                .then(async (res) => {
                    const info = await res.json();
                    players.value = info.players;
                    server.value = info.server;
                    authorized.value = true;
                    localStorage.setItem("password", password.value);
                })
                .catch((e) => console.log(e));
        };
        if (storedPassword) {
            authorize(); // will fail silently if stored password is out of date
        }
        const msToHMS = (ms: number) =>
            new Date(ms).toISOString().slice(11, 19);
        const msToS = (ms: number) => Number(ms / 1000).toFixed(2);
        return {
            msToHMS,
            msToS,
            password,
            authorized,
            players,
            server,
            authorize,
        };
    },
});
</script>

<style lang="scss">
body {
    font-family: sans-serif;
}
#stats-container {
    background-color: white;
    border: 1px black solid;
    border-radius: 3px;
    padding: 3px;
}
pre {
    display: inline;
    white-space: pre-wrap;
}
thead {
    border: 2px solid #333;
}
td,
th {
    padding: 10px;
    width: 150px;
}
th {
    border-right: 1px solid #333;
}
td {
    text-align: center;
}
tr:nth-of-type(even) td:nth-of-type(even) {
    background-color: #eee;
}
tr:nth-of-type(odd) td:nth-of-type(odd) {
    background-color: #eee;
}
table {
    border-collapse: collapse;
    letter-spacing: 1px;
    font-size: 0.8rem;
}
</style>
