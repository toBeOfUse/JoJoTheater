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
                        <template v-else>{{ conn.chatName }}</template>
                    </td>
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
        <p>
            Current server state: Playing: {{ server.playing }}, current time:
            {{ msToHMS(server.currentTimeMs) }}, current video:
            {{ server.video.title }}
        </p>
    </template>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from "vue";
import type { ConnectionStatus, VideoState } from "../../types";
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
                .catch((e) => {
                    console.log(e);
                    password.value = "";
                });
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
