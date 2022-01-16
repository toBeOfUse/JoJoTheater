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
                    <th scope="col">Estimated Video Progress</th>
                    <th scope="col">Latest ping</th>
                    <th scope="col">Average ping</th>
                    <th scope="col">Recent Pings</th>
                    <th scope="col">Approx. location</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(conn, i) in players" :key="i">
                    <td>{{ msToS(conn.uptimeMs) }} seconds</td>
                    <td>
                        <em v-if="!conn.chatName">not logged in</em>
                        <span v-else v-html="conn.chatName" />
                    </td>
                    <td style="text-align: left; font-size: small">
                        <template v-if="conn.playerState">
                            <strong>Playing: </strong
                            >{{ conn.playerState.playing }}
                            <br />
                            <strong>Current Time:</strong>
                            {{ msToHMS(conn.playerState.currentTimeMs) }}
                            <br />
                            <strong>Video: </strong
                            >{{ conn.playerState.video.title }}
                            <br />
                            <strong>Last Update Time:</strong>
                            {{ conn.playerState.receivedTimeISO }}
                        </template>
                    </td>
                    <td>{{ estimateProgress(conn.playerState) }}</td>
                    <td>{{ conn.latestPing }} ms</td>
                    <td>{{ Math.round(conn.avgPing) }} ms</td>
                    <td>
                        <LineChart
                            :chartData="charts[i]"
                            :width="200"
                            :height="100"
                        />
                    </td>
                    <td>{{ conn.location }}</td>
                </tr>
            </tbody>
        </table>
        <h3>Current server state:</h3>
        <p>
            Playing: {{ server.playing }}, current time:
            {{ msToHMS(server.currentTimeMs) }}, current video:
            {{ server.video.title }}
        </p>
        <h3>Chat history dump:</h3>
        <p class="chat-history" v-html="messagesHTML"></p>
    </template>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from "vue";
import type { ConnectionStatus, VideoState, ChatMessage } from "../../types";
import {
    Chart,
    LineController,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    ChartData,
} from "chart.js";
Chart.register(
    LineController,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement
);
import { LineChart } from "vue-chart-3";

export default defineComponent({
    components: { LineChart },
    setup() {
        const players = ref<ConnectionStatus[]>([]);
        const server = ref<ConnectionStatus | null>(null);
        const messages = ref<ChatMessage[]>([]);
        const authorized = ref(false);
        const storedPassword = localStorage.getItem("password");
        const password = ref(storedPassword ?? "");
        const authorize = async () => {
            const headers = { headers: { Authorization: password.value } };
            await fetch("/api/stats", headers)
                .then(async (res) => {
                    const info = await res.json();
                    players.value = info.players;
                    server.value = info.server;
                    authorized.value = true;
                    localStorage.setItem("password", password.value);
                })
                .catch((e) => {
                    console.log(e);
                    password.value = "";
                });
            fetch("/api/messages", headers)
                .then(async (res) => {
                    messages.value = await res.json();
                })
                .catch((e) => console.log(e));
        };
        if (storedPassword) {
            authorize(); // will fail silently if stored password is out of date
        }
        const charts = computed(() => {
            return players.value.map((p): ChartData => {
                return {
                    labels: Array(p.pingHistory.length).fill(""),
                    datasets: [
                        {
                            data: p.pingHistory,
                            borderColor: "rgb(0,0,0)",
                            borderWidth: 1,
                            pointRadius: 0,
                        },
                    ],
                };
            });
        });
        const msToHMS = (ms: number) =>
            new Date(ms).toISOString().slice(11, 19);
        const msToS = (ms: number) => Number(ms / 1000).toFixed(2);
        const estimateProgress = (
            state: VideoState & { receivedTimeISO: string }
        ): string => {
            if (state.playing) {
                return msToHMS(
                    state.currentTimeMs +
                        (new Date().getTime() -
                            new Date(state.receivedTimeISO).getTime())
                );
            } else {
                return msToHMS(state.currentTimeMs);
            }
        };
        const messagesHTML = computed<string>(() => {
            let result = "";
            for (let i = 0; i < messages.value.length; i++) {
                const message = messages.value[i];
                if (i != 0) {
                    result += "  ◦  ";
                }
                if (
                    message.senderID &&
                    (i == 0 ||
                        messages.value[i - 1].senderID != message.senderID)
                ) {
                    result += message.senderName + ": ";
                }
                result += message.messageHTML;
            }
            return result;
        });
        return {
            msToHMS,
            msToS,
            password,
            authorized,
            players,
            server,
            authorize,
            charts,
            estimateProgress,
            messagesHTML,
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
    padding: 5px;
    display: flex;
    flex-direction: column;
    max-width: 80%;
    @media (max-width: 800px) {
        max-width: 95%;
    }
}
h3 {
    margin: 5px 0;
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
.chat-history {
    white-space: break-spaces;
}
</style>
