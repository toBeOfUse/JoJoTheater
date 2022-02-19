<template>
    <svg viewBox="-250 0 500 80" ref="svg">
        <g v-for="(group, j) in groups" :key="j" :style="group.style">
            <path
                v-for="(path, i) in group.children"
                :key="i"
                :fill="path.fill"
                :d="path.initialD"
            >
                <animate
                    v-for="(animation, i) in path.animations"
                    :key="i"
                    :id="animation.id"
                    :class="animation.class"
                    attributeName="d"
                    begin="indefinite"
                    repeatCount="1"
                    fill="freeze"
                    :dur="animation.duration + 's'"
                    calcMode="spline"
                    :keySplines="animation.spline.join(' ')"
                    :from="animation.start"
                    :to="animation.end"
                />
            </path>
        </g>
    </svg>
</template>

<script lang="ts">
import {
    defineComponent,
    nextTick,
    onMounted,
    reactive,
    ref,
    watch,
} from "vue";

export default defineComponent({
    props: {
        state: {
            type: String,
            required: true,
            validator: (prop: string) =>
                ["closed", "slightlyOpen", "open", "descended"].includes(prop),
        },
    },
    setup(props, context) {
        const svg = ref<SVGSVGElement | null>(null);

        // type definitions for the variables that will describe our animated paths
        type pathD = string;
        type Spline = [number, number, number, number];
        interface Animation {
            id: string;
            class: string;
            duration: number;
            spline: Spline;
        }
        interface PathAnimation extends Animation {
            start: pathD;
            end: pathD;
        }

        class AnimatedPath {
            initialD: pathD;
            animations: PathAnimation[];
            fill: string;
            constructor(
                initialD: pathD,
                animations: PathAnimation[],
                fill: string
            ) {
                this.initialD = initialD;
                this.animations = animations;
                this.fill = fill;
            }
        }

        // fills for our animated paths
        const bgFill = "#cd1313ff";
        const fgFill = "#7a0b0b33";
        // data describing the states that our animated paths can be in
        const curtainBGNotSwished =
            "M -2.6867292,0.19606453 H 250.02168 C 250.38805,38.725053 252.1884,82.896666 250.16019,83.208696 250.16019,83.208696 244.8567,81.397476 241.22322,77.909486 239.81212,77.806216 236.03354,83.226286 234.51726,83.061746 232.58058,82.851586 230.39013,78.406716 227.25513,78.319856 224.83728,78.252856 222.64781,82.853316 220.84432,82.706416 218.35914,82.503996 213.5553,78.184946 211.07163,78.034236 208.62261,77.885626 205.16968,82.620246 202.81868,82.404996 198.5668,82.015706 196.89826,77.266166 192.86863,77.128356 190.83829,77.058956 187.63753,82.734776 185.74431,82.645726 184.11374,82.569026 179.2085,76.558616 177.71481,76.513766 175.44066,76.445466 169.9869,83.862576 168.12794,83.762166 163.43849,83.508856 159.58295,77.177446 158.9679,77.245766 155.34604,77.648096 154.69107,83.387306 151.64121,83.337296 148.59136,83.287296 148.61536,77.992526 145.0825,77.510196 141.54964,77.027866 137.67334,83.183286 133.74616,83.056646 129.81899,82.930006 128.01142,77.666126 124.23657,77.618206 120.46173,77.570306 117.64904,83.240086 113.93944,83.164976 110.22983,83.089876 108.88653,78.088286 104.84752,77.781586 100.80852,77.474886 95.626469,83.451026 92.105289,82.915626 88.584099,82.380216 89.270759,78.453066 86.193745,78.087996 83.116745,77.722926 80.381365,82.713856 76.319026,82.841296 72.256686,82.968736 68.496792,77.760126 63.879612,77.787486 59.262433,77.814886 54.330763,83.673666 50.717427,83.317566 47.104091,82.961466 47.827337,79.593446 44.496149,79.113926 41.164961,78.634416 36.129005,83.480056 32.409383,82.962916 28.689761,82.445786 27.664439,77.632036 24.197059,77.528546 20.729679,77.425056 18.105228,83.299926 14.707422,83.023936 11.309615,82.747936 8.5513387,75.335456 7.3717692,77.006406 6.1921989,78.677366 2.276979,84.827336 -2.5038472,84.778886 -1.091045,66.673896 -0.56149296,35.117635 -2.6867292,0.19606453 Z";
        const curtainBGOpeningSwish =
            "M -2.7108261,0.20405153 H 249.99759 C 244.64455,38.256422 278.37969,79.479876 282.33527,80.290556 282.33527,80.290556 275.56873,81.405446 271.93525,77.917456 270.52415,77.814186 266.74557,83.234256 265.22929,83.069716 263.29261,82.859556 261.10216,78.414686 257.96716,78.327826 255.54931,78.260826 253.35984,82.861286 251.55635,82.714386 249.07117,82.511966 244.26733,78.192916 241.78366,78.042206 239.33464,77.893596 235.88171,82.628216 233.53071,82.412966 229.27883,82.023676 227.61029,77.274136 223.58066,77.136326 221.55032,77.066926 218.34956,82.742746 216.45634,82.653696 214.82577,82.576996 209.92053,76.566586 208.42684,76.521736 206.15269,76.453436 200.69893,83.870546 198.83997,83.770136 194.15052,83.516826 190.29498,77.185416 189.67993,77.253736 186.05807,77.656066 185.4031,83.395276 182.35324,83.345266 179.30339,83.295266 179.32739,78.000496 175.79453,77.518166 172.26167,77.035836 168.38537,83.191256 164.45819,83.064616 160.53102,82.937976 158.72345,77.674096 154.9486,77.626176 151.17376,77.578276 148.36107,83.248056 144.65147,83.172946 140.94186,83.097846 139.59856,78.096256 135.55955,77.789556 131.52055,77.482856 126.3385,83.458996 122.81732,82.923596 119.29613,82.388186 119.98279,78.461036 116.90578,78.095966 113.82878,77.730896 111.0934,82.721826 107.03106,82.849266 102.96872,82.976706 99.20882,77.768096 94.591629,77.795456 89.974457,77.822856 85.042787,83.681636 81.429451,83.325536 77.816115,82.969436 78.539361,79.601416 75.208173,79.121896 71.876985,78.642386 66.841029,83.488026 63.121407,82.970886 59.401785,82.453756 58.376463,77.640006 54.909083,77.536516 51.441703,77.433026 48.817252,83.307896 45.419446,83.031906 42.021639,82.755906 39.263363,75.343426 38.083793,77.014376 36.904223,78.685336 30.062895,82.092076 25.282069,82.043626 12.667901,63.243296 -2.3168735,34.820102 -2.7108261,0.20405153 Z";
        const curtainFGNotSwished =
            "M 170.21949,0.19588853 C 171.28084,28.511505 172.94644,57.364036 170.3492,82.427566 172.30324,80.722616 174.83961,77.878866 176.61393,76.878546 177.87579,52.247836 176.87293,26.107151 176.21396,0.19588853 Z M 186.45083,0.19588853 C 187.15661,27.882386 188.67066,55.914946 186.56504,82.396556 188.46997,81.320326 191.10838,77.067986 192.86853,77.128146 192.95886,77.131246 193.03418,77.148436 193.11968,77.156056 195.14108,51.502586 193.32215,25.849349 192.50783,0.19588853 Z M 204.82675,0.19588853 C 206.19839,27.889752 208.82057,56.160986 205.16162,81.533046 207.14123,80.225916 209.35326,77.929746 211.07185,78.034036 211.08778,78.035096 211.10347,78.040466 211.11939,78.041786 212.54554,52.093096 211.29821,26.144574 210.75714,0.19588853 Z M 220.2969,0.19588853 C 221.12647,28.291064 223.61882,57.716626 220.48552,82.641506 220.60474,82.669656 220.72386,82.696816 220.84416,82.706616 222.53374,82.844236 224.56234,78.815536 226.79987,78.361146 228.7769,52.306016 226.93541,26.251021 226.31204,0.19588853 Z M 234.5658,0.19588853 C 235.43178,28.034591 238.29715,56.418506 234.70739,83.041996 236.32596,82.803516 239.86636,77.810186 241.22327,77.909496 241.23494,77.920716 241.24367,77.929846 241.25531,77.941016 243.68347,52.025916 241.30667,26.110985 240.58869,0.19588853 Z M 33.151188,0.19587553 C 34.386858,27.779326 34.939049,55.362426 33.66485,82.945876 35.20382,82.744076 36.888676,81.919316 38.548791,81.076726 40.317671,54.341506 39.631461,27.278835 38.827326,0.20000553 L 38.41805,0.19601053 Z M 49.976002,0.19587553 C 51.216639,27.890266 51.768819,55.584276 50.474681,83.278666 50.556961,83.290656 50.630338,83.308866 50.717558,83.317466 52.095082,83.453226 53.665617,82.683156 55.335881,81.679826 57.15546,54.748636 56.462834,27.482395 55.652656,0.20004553 L 55.24338,0.19605053 Z M 93.151669,0.19587553 C 94.379049,27.728526 94.921819,55.261306 93.640519,82.793946 95.146459,82.406916 96.839109,81.330166 98.5627,80.264376 100.28679,53.793476 99.61819,27.003165 98.82315,0.19587553 Z M 114.83768,0.19587553 C 116.02483,27.799196 116.49984,55.402506 115.09089,83.005796 115.11869,82.997806 115.14639,82.989506 115.17409,82.981006 L 120.02703,79.524886 C 121.84594,53.304786 121.25469,26.762762 120.47661,0.19587253 Z M 135.27519,0.19587553 C 136.47632,27.687354 136.97944,55.178456 135.64054,82.669916 137.31621,81.998716 138.97219,80.576286 140.58856,79.379686 142.32853,53.202186 141.70885,26.710036 140.92756,0.19587553 Z M 153.22758,0.19587553 C 154.41357,27.625865 154.89746,55.055986 153.53713,82.485946 155.11489,80.958586 156.13923,77.859756 158.59573,77.309506 160.21222,51.808626 159.62894,26.013806 158.87117,0.19587553 Z M 3.8878589,0.50800453 C 5.1703439,27.287566 5.7249479,54.067206 4.2630299,80.846776 L 4.6764409,80.571346 C 5.9448499,79.120976 6.8897749,77.689136 7.3718832,77.006186 7.7541532,76.464666 8.3043487,76.883736 8.9862567,77.698126 L 9.2007117,77.554986 C 11.086321,52.111036 10.384487,26.343615 9.5665827,0.56173353 Z M 17.420882,0.50800453 C 18.703368,27.287566 19.257972,54.067206 17.796053,80.846776 L 22.733738,77.554986 C 24.619344,52.111036 23.91751,26.343615 23.099604,0.56173353 Z M 70.091053,0.87386553 C 71.282747,27.457034 71.843404,54.040386 70.744243,80.623516 72.318154,81.618376 73.858077,82.550846 75.429228,82.784636 77.280589,55.732256 76.58369,28.339496 75.769776,0.93123453 Z";
        const curtainFGOpeningSwish =
            "M 170.1954,0.20387153 C 161.1546,34.441442 193.76002,63.174546 201.06123,82.435536 203.01527,80.730586 204.77439,78.435486 206.54871,77.435166 191.21833,53.307246 172.13189,26.258072 176.18987,0.20387153 Z M 186.42674,0.20387153 C 183.87407,28.882072 207.80075,59.447846 217.27707,82.404526 219.182,81.328286 221.82041,77.075946 223.58056,77.136116 223.67086,77.139116 223.74621,77.156416 223.83171,77.164016 208.142,51.510556 191.33465,25.857332 192.48374,0.20387153 Z M 204.80266,0.20387153 C 200.16789,29.353832 223.75235,59.994476 235.87365,81.541016 237.85326,80.233886 240.06529,77.937716 241.78388,78.041996 241.79978,78.042996 241.81548,78.047996 241.83138,78.049996 226.68465,54.774356 208.48731,26.602282 210.73301,0.20411153 Z M 220.27281,0.20387153 C 217.00785,28.416042 236.18938,58.242916 251.19755,82.649466 251.31677,82.677666 251.43589,82.704766 251.55619,82.714566 253.24577,82.852186 255.27437,78.823486 257.5119,78.369096 239.10124,58.375156 224.51467,26.971502 226.28795,0.20385153 Z M 234.54171,0.20387153 C 233.05667,28.042572 250.97272,56.426466 265.41942,83.049966 267.03799,82.811476 270.57839,77.818156 271.9353,77.917466 271.947,77.928666 271.9557,77.937766 271.9673,77.948966 255.2506,54.934606 240.23439,26.277772 240.56456,0.20385153 Z M 33.127091,0.20386153 C 27.456951,28.773852 52.502196,57.248806 64.376874,82.953846 65.915844,82.752046 67.6007,81.927286 69.260815,81.084696 56.305518,56.357316 33.712862,28.090622 38.803229,0.20799153 L 38.393953,0.20399153 Z M 49.951905,0.20386153 C 44.745476,28.141542 64.316946,56.277676 81.186705,83.286636 81.268985,83.298636 81.342362,83.316836 81.429582,83.325436 82.807106,83.461196 84.377641,82.691126 86.047905,81.687796 69.442165,57.236936 51.080627,28.211662 55.628559,0.20803153 L 55.219283,0.20403153 Z M 93.127569,0.20386153 C 87.152194,26.853942 110.08884,53.315426 124.35255,82.801916 125.85849,82.414886 127.55114,81.338136 129.27473,80.272346 116.3598,53.179776 91.64996,26.676372 98.79906,0.20386153 Z M 114.81359,0.20386153 C 110.62648,27.135402 131.43139,56.008176 145.80292,83.013766 145.83072,83.005766 145.85842,82.997466 145.88612,82.988966 L 150.73906,79.532846 C 133.56815,54.360306 115.47801,26.770732 120.45252,0.20385153 Z M 135.2511,0.20386153 C 129.61232,29.274512 151.80749,59.853256 166.35257,82.677886 168.02824,82.006686 169.68422,80.584256 171.30059,79.387656 157.59143,61.494976 136.29781,28.691202 140.90347,0.20386153 Z M 153.20349,0.20386153 C 145.48421,27.671622 167.76779,58.642116 184.24916,82.493916 185.82692,80.966556 186.85126,77.867726 189.30776,77.317476 173.91954,59.298416 153.91855,29.120942 158.84708,0.20386153 Z M 3.8637619,0.51599153 C 3.9438119,27.720892 26.379235,58.552836 34.975054,80.854746 L 35.388465,80.579316 C 36.656874,79.128946 37.601799,77.697106 38.083907,77.014156 38.466177,76.472636 39.016373,76.891706 39.698281,77.706096 L 39.912736,77.562956 C 30.574079,52.119006 9.9082287,26.351602 9.5424857,0.56972153 Z M 17.396785,0.51599153 C 14.664763,29.079782 37.401835,59.661026 48.508077,80.854746 L 53.445762,77.562956 C 41.582943,55.834796 21.147567,27.093722 23.075507,0.56972153 Z M 70.066956,0.88185153 C 65.89948,27.717872 84.276891,54.727596 101.45627,80.631486 103.03019,81.626346 104.57011,82.558816 106.14126,82.792606 90.876659,50.054436 70.138505,26.065452 75.745679,0.93922153 Z";
        const curtainBGClosingSwish =
            "M -2.5302168,0.32135667 H 250.17821 C 254.95028,47.578377 239.69968,84.490287 238.27284,80.407857 238.27284,80.407857 231.5063,81.522747 227.87282,78.034757 226.46172,77.931487 222.68314,83.351557 221.16686,83.187017 219.23018,82.976857 217.03973,78.531987 213.90473,78.445127 211.48688,78.378127 209.29741,82.978587 207.49392,82.831687 205.00874,82.629267 200.2049,78.310217 197.72123,78.159507 195.27221,78.010897 191.81928,82.745517 189.46828,82.530267 185.2164,82.140977 183.54786,77.391437 179.51823,77.253627 177.48789,77.184227 174.28713,82.860047 172.39391,82.770997 170.76334,82.694297 165.8581,76.683887 164.36441,76.639037 162.09026,76.570737 156.6365,83.987847 154.77754,83.887437 150.08809,83.634127 146.23255,77.302717 145.6175,77.371037 141.99564,77.773367 141.34067,83.512577 138.29081,83.462567 135.24096,83.412567 135.26496,78.117797 131.7321,77.635467 128.19924,77.153137 124.32294,83.308557 120.39576,83.181917 116.46859,83.055277 114.66102,77.791397 110.88617,77.743477 107.11133,77.695577 104.29864,83.365357 100.58904,83.290247 96.879427,83.215147 95.536127,78.213557 91.497117,77.906857 87.458117,77.600157 82.276067,83.576297 78.754887,83.040897 75.233697,82.505487 75.920357,78.578337 72.843347,78.213267 69.766347,77.848197 67.030967,82.839127 62.968627,82.966567 58.906287,83.094007 55.146382,77.885397 50.529192,77.912757 45.912012,77.940157 40.980342,83.798937 37.367012,83.442837 33.753672,83.086737 34.476922,79.718717 31.145732,79.239197 27.814542,78.759687 22.778592,83.605327 19.058962,83.088187 15.339342,82.571057 14.314022,77.757307 10.846642,77.653817 7.3792618,77.550327 4.7548118,83.425197 1.3570018,83.149207 -2.0407982,82.873207 -4.7990782,75.460727 -5.9786482,77.131677 -7.1582182,78.802637 -13.999548,82.209377 -18.780368,82.160927 -4.6868424,49.602087 -2.1362668,34.937407 -2.5302168,0.32135667 Z";
        const curtainFGClosingSwish =
            "M 170.37602,0.32117667 C 171.92147,30.267027 165.50612,56.882987 156.9988,82.552837 158.95284,80.847887 160.71196,78.552787 162.48628,77.552467 173.52639,65.264357 178.49642,29.151827 176.37049,0.32117667 Z M 186.60736,0.32117667 C 188.13735,28.999377 180.3203,59.565147 173.21464,82.521827 175.11957,81.445587 177.75798,77.193247 179.51813,77.253417 179.60843,77.256417 179.68378,77.273717 179.76928,77.281317 186.6001,66.960987 196.12868,18.944597 192.66436,0.32117667 Z M 204.98328,0.32117667 C 206.25641,29.471137 201.31649,60.111777 191.81122,81.658317 193.79083,80.351187 196.00286,78.055017 197.72145,78.159297 197.73735,78.160297 197.75305,78.165297 197.76895,78.167297 204.55236,65.017117 213.56848,29.422607 210.91363,0.32141667 Z M 220.45343,0.32117667 C 229.29144,33.941057 213.29486,67.818217 207.13512,82.766767 207.25434,82.794967 207.37346,82.822067 207.49376,82.831867 209.18334,82.969487 211.21194,78.940787 213.44947,78.486397 221.593,65.734507 236.43749,30.291227 226.46857,0.32115667 Z M 234.72233,0.32117667 C 243.00237,31.915677 224.68963,63.381977 221.35699,83.167267 222.97556,82.928777 226.51596,77.935457 227.87287,78.034767 227.88457,78.045967 227.89327,78.055067 227.90487,78.066267 231.55222,66.891467 250.15565,32.058237 240.74518,0.32115667 Z M 33.307703,0.32116667 C 38.158776,29.970257 33.798574,54.398587 20.314432,83.071147 21.853402,82.869347 23.538262,82.044587 25.198372,81.201997 45.956611,53.515397 46.533208,17.726387 38.983843,0.32529667 L 38.574563,0.32129667 Z M 50.132513,0.32116667 C 54.098423,22.863357 48.580846,50.999487 37.124262,83.403937 37.206542,83.415937 37.279922,83.434137 37.367142,83.442737 38.744662,83.578497 40.315202,82.808427 41.985462,81.805097 57.213137,60.051987 63.401095,24.821897 55.809173,0.32533667 L 55.399893,0.32133667 Z M 93.308183,0.32116667 C 98.670702,23.961427 88.200074,67.777517 80.290117,82.919217 81.796057,82.532187 83.488707,81.455437 85.212297,80.389647 93.330924,69.299247 105.3818,23.720207 98.979673,0.32116667 Z M 114.99421,0.32116667 C 120.0119,20.364557 117.21586,68.096407 101.74049,83.131067 101.76829,83.123067 101.79599,83.114767 101.82369,83.106267 L 106.67663,79.650147 C 121.75548,77.840387 127.93768,11.507217 120.63314,0.32115667 Z M 135.43172,0.32116667 C 140.31415,25.345197 133.91321,59.161237 122.29014,82.795187 123.96581,82.123987 125.62179,80.701557 127.23816,79.504957 138.73524,70.208667 144.93437,47.306517 141.08409,0.32116667 Z M 153.38411,0.32116667 C 158.63494,15.698147 143.29564,71.567107 140.18673,82.611217 141.76449,81.083857 142.78883,77.985027 145.24533,77.434777 153.38244,74.473947 162.11543,29.288287 159.0277,0.32116667 Z M 4.0443732,0.63329667 C 8.6803211,26.572667 1.6835337,53.290487 -9.0873884,80.972047 L -8.6739784,80.696617 C -7.4055682,79.246247 -6.4606382,77.814407 -5.9785382,77.131457 -5.5962682,76.589937 -5.0460682,77.009007 -4.3641582,77.823397 L -4.1497082,77.680257 C 13.489112,53.045627 10.088833,26.468907 9.723093,0.68702667 Z M 17.577393,0.63329667 C 23.747938,23.531817 14.651593,59.508557 4.4456318,80.972047 L 9.3833218,77.680257 C 23.688648,61.077817 28.881865,27.750577 23.256113,0.68702667 Z M 70.247563,0.99915667 C 74.954216,29.839827 68.088676,61.646497 57.393837,80.748787 58.967757,81.743647 60.507677,82.676117 62.078827,82.909907 81.303975,44.943497 78.928839,21.603577 75.926293,1.0565267 Z";

        // exhaustive descriptions of the animations that will morph our
        // animated paths from one state to another
        const swishStartDuration = 0.4;
        const swishEndDuration = 0.4;
        const swishStartSpline: Spline = [0.41, 0.65, 0.74, 0.98];
        const swishEndSpline: Spline = [0.62, 0.29, 0.74, 0.98];

        const bgOpenSwishStart: PathAnimation = {
            id: "openbgswishstart",
            class: "openswishstart",
            start: curtainBGNotSwished,
            end: curtainBGOpeningSwish,
            duration: swishStartDuration,
            spline: swishStartSpline,
        };
        const fgOpenSwishStart: PathAnimation = {
            id: "openfgswishstart",
            class: "openswishstart",
            start: curtainFGNotSwished,
            end: curtainFGOpeningSwish,
            duration: swishStartDuration,
            spline: swishStartSpline,
        };
        const bgOpenSwishEnd: PathAnimation = {
            id: "openbgswishend",
            class: "openswishend",
            start: curtainBGOpeningSwish,
            end: curtainBGNotSwished,
            duration: swishEndDuration,
            spline: swishEndSpline,
        };
        const fgOpenSwishEnd: PathAnimation = {
            id: "openfgswishend",
            class: "openswishend",
            start: curtainFGOpeningSwish,
            end: curtainFGNotSwished,
            duration: swishEndDuration,
            spline: swishEndSpline,
        };
        const bgCloseSwishStart: PathAnimation = {
            id: "closebgswishstart",
            class: "closeswishstart",
            start: curtainBGNotSwished,
            end: curtainBGClosingSwish,
            duration: swishStartDuration,
            spline: swishStartSpline,
        };
        const fgCloseSwishStart: PathAnimation = {
            id: "closefgswishstart",
            class: "closeswishstart",
            start: curtainFGNotSwished,
            end: curtainFGClosingSwish,
            duration: swishStartDuration,
            spline: swishStartSpline,
        };
        const bgCloseSwishEnd: PathAnimation = {
            id: "closebgswishend",
            class: "closeswishend",
            start: curtainBGClosingSwish,
            end: curtainBGNotSwished,
            duration: swishEndDuration,
            spline: swishEndSpline,
        };
        const fgCloseSwishEnd: PathAnimation = {
            id: "closefgswishend",
            class: "closeswishend",
            start: curtainFGClosingSwish,
            end: curtainFGNotSwished,
            duration: swishEndDuration,
            spline: swishEndSpline,
        };

        const leftBG = new AnimatedPath(
            curtainBGNotSwished,
            [
                bgOpenSwishStart,
                bgOpenSwishEnd,
                bgCloseSwishStart,
                bgCloseSwishEnd,
            ],
            bgFill
        );
        const leftFG = new AnimatedPath(
            curtainFGNotSwished,
            [
                fgOpenSwishStart,
                fgOpenSwishEnd,
                fgCloseSwishStart,
                fgCloseSwishEnd,
            ],
            fgFill
        );

        // function that can activate the animations described above after
        // they're rendered into the DOM as <animate> elements
        const activateAnimation = (className: string) => {
            if (svg.value) {
                svg.value
                    .querySelectorAll("animate." + className)
                    .forEach((e) => (e as any).beginElement());
            } else {
                console.warn(
                    "tried to activate " +
                        className +
                        " animations but curtains svg is not mounted"
                );
            }
        };

        // type definition for objects representing the <g> elements that will
        // group our paths into distinct curtains and move them around
        class TranslationGroup {
            children: AnimatedPath[];
            currentPos: [number, number];
            basePos: [number, number];
            _style: Record<string, string>;
            transitionDuration: number;
            transitionSpline: Spline;
            constructor(
                basePos: [number, number],
                children: AnimatedPath[],
                style: Record<string, string>,
                initialTransitionDuration: number,
                spline: Spline
            ) {
                this.basePos = basePos;
                this.currentPos = basePos;
                this.children = children;
                this._style = style;
                this.transitionDuration = initialTransitionDuration;
                this.transitionSpline = spline;
            }
            get style() {
                let transform = `translate(${this.currentPos
                    .map((p) => p + "px")
                    .join(", ")})`;
                if ("transform" in this._style) {
                    transform = this._style.transform + " " + transform;
                }
                return {
                    ...this._style,
                    transform,
                    transition: `transform ${
                        this.transitionDuration
                    }s cubic-bezier(${this.transitionSpline.join(", ")})`,
                };
            }
        }

        // data describing the animations that will move our curtains around
        const movementSpline: Spline = [0.18, 0.29, 0.74, 0.98];
        const initialLeftPos = -250;
        const openSlightlyDuration = 0.75;
        const openFullyDuration = 2;
        const openSlightlyOffset = 25;
        const openFullyOffset = 275;
        const raisedOffset = 80; // the only y-offset
        const descendDuration = 0.5;

        type CurtainPos = [number, number]; // numbers to go into translate(x, y) CSS function
        const closedPos: CurtainPos = [initialLeftPos, 0];
        const slightlyOpenPos: CurtainPos = [
            initialLeftPos - openSlightlyOffset,
            0,
        ];
        const fullyOpenPos: CurtainPos = [initialLeftPos - openFullyOffset, 0];
        const raisedPos: CurtainPos = [initialLeftPos, -raisedOffset];

        const leftGroup = new TranslationGroup(
            [initialLeftPos, 0],
            [leftBG, leftFG],
            {},
            openSlightlyDuration,
            movementSpline
        );

        const rightGroup = new TranslationGroup(
            [initialLeftPos, 0],
            [leftBG, leftFG],
            { transform: "scaleX(-1)" },
            openSlightlyDuration,
            movementSpline
        );

        const groups = reactive([leftGroup, rightGroup]);

        const applyCSSTransform = () => {
            // https://stackoverflow.com/a/23551084
            // ...
            // seems to work ???
            if (!svg.value) {
                return;
            } else {
                for (const g of Array.from(svg.value.querySelectorAll("g"))) {
                    window.getComputedStyle(g).getPropertyValue("transform");
                }
            }
        };

        // function to apply the curtain positions described above
        const applyPos = async (
            pos: CurtainPos,
            transitionDuration?: number
        ) => {
            for (const group of groups) {
                group.transitionDuration = transitionDuration || 0;
                group.currentPos = pos;
            }
            await nextTick();
            applyCSSTransform();
        };

        // high level functions that will animate the curtains from position to
        // position and morph the paths swishily as necessary
        const playOpenSlightly = async () => {
            console.log("playing open slightly animation");
            await applyPos(closedPos);
            applyPos(slightlyOpenPos, openSlightlyDuration);
            activateAnimation("openswishstart");
            setTimeout(() => {
                activateAnimation("openswishend");
            }, (openSlightlyDuration - swishEndDuration) * 1000);
        };

        const playOpenFully = async () => {
            console.log("playing open fully animation");
            applyPos(fullyOpenPos, openFullyDuration);
            activateAnimation("openswishstart");
            setTimeout(() => {
                context.emit("outoftheway");
                activateAnimation("openswishend");
            }, openFullyDuration * 1000);
        };

        const playCloseMostly = async () => {
            context.emit("backintheway");
            await nextTick();
            await applyPos(fullyOpenPos);
            applyPos(slightlyOpenPos, openFullyDuration - openSlightlyDuration);
            activateAnimation("closeswishstart");
            setTimeout(() => {
                activateAnimation("closeswishend");
            }, (openSlightlyDuration - swishEndDuration / 2) * 1000);
        };

        const playCloseFully = async () => {
            context.emit("backintheway");
            await nextTick();
            await applyPos(fullyOpenPos);
            applyPos(closedPos, openFullyDuration);
            activateAnimation("closeswishstart");
            setTimeout(() => {
                activateAnimation("closeswishend");
            }, (openFullyDuration - swishEndDuration / 2) * 1000);
        };

        const playDescend = async () => {
            context.emit("backintheway");
            await nextTick();
            await applyPos(raisedPos);
            applyPos(closedPos, descendDuration);
        };

        const playAscend = async () => {
            await applyPos(closedPos);
            applyPos(raisedPos, descendDuration);
            setTimeout(() => {
                context.emit("outoftheway");
            }, descendDuration * 1000);
        };

        onMounted(() => {
            // if already or slightly open: animate to that
            if (props.state == "slightlyOpen") {
                playOpenSlightly();
            } else if (props.state == "open") {
                playOpenFully();
            }
            watch(
                () => props.state,
                (value, oldValue) => {
                    if (value == "slightlyOpen") {
                        if (oldValue == "closed") {
                            playOpenSlightly();
                        } else if (oldValue == "open") {
                            playCloseMostly();
                        }
                    } else if (value == "open") {
                        if (oldValue == "descended") {
                            playAscend();
                        } else {
                            playOpenFully();
                        }
                    } else if (value == "closed") {
                        console.warn(
                            "we're not really set up to completely re-close things"
                        );
                        playCloseFully();
                    } else if (value == "descended") {
                        playDescend();
                    }
                }
            );
        });

        return { svg, groups };
    },
});
</script>
