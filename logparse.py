import json
from pprint import pprint
from datetime import timedelta


def mstohms(ms: float):
    d = timedelta(milliseconds=ms)
    return str(d)


log = []

with open("debug.log", encoding="utf-8") as logfile:
    rawlog = ""
    opencount = 0
    for line in logfile:
        opencount += line.count("{")
        opencount -= line.count("}")
        if opencount == 0:
            rawlog += line
            parsed = json.loads(rawlog)
            try:
                parsed_message: dict = json.loads(parsed["message"])
                for key in list(parsed_message.keys()):
                    if key.endswith("Ms"):
                        parsed_message[key[0:-2]] = mstohms(parsed_message[key])
                parsed["message"] = parsed_message
            except (ValueError, KeyError):
                pass
            log.append(parsed)
            rawlog = ""
        else:
            rawlog += line

print("total log entries:", len(log))

ur = 0
ew = []
nm = []
cr = []
for i in range(len(log)):
    entry = log[i]
    if entry["level"] == "error" or entry["level"] == "warning":
        ew.append(entry)
    if "message" in entry:
        if "state_update_request" in entry["message"]:
            ur += 1
        if ("emitting accepted player state" in entry["message"] and
                entry["timestamp"] > "2021-12-03"):
            if len(log) > (i + 1):
                cr.append(log[i + 1])
    else:
        nm.append(entry)

print("Errors and warnings:")
pprint(ew)
print("number of state update requests:")
pprint(ur)
print("non message log entries")
pprint(nm)
print("state change requests:")
pprint(cr)
