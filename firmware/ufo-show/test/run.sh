#!/bin/sh
# Host tests for UfoCmd.h, then mutants: each mutant must make the tests FAIL.
set -u
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/ufocmd.XXXXXX")
trap 'rm -rf "${tmp:?}"' EXIT

echo "== real"
c++ -std=c++17 -O1 -Wall -Wno-unused-function -fsanitize=address "$here/ufocmd_test.cpp" -o "$tmp/t" && "$tmp/t" || { echo "REAL TESTS FAILED"; exit 1; }

mutate() {  # name, sed expression
  mkdir -p "$tmp/m/test"
  sed "$2" "$here/../UfoCmd.h" > "$tmp/m/UfoCmd.h"
  if cmp -s "$tmp/m/UfoCmd.h" "$here/../UfoCmd.h"; then echo "mutant $1: sed did not change anything"; exit 1; fi
  cp "$here/../UfoShow.h" "$tmp/m/"
  cp "$here/ufocmd_test.cpp" "$tmp/m/test/"
  if c++ -std=c++17 -O1 -fsanitize=address "$tmp/m/test/ufocmd_test.cpp" -o "$tmp/mt" 2>/dev/null && "$tmp/mt" >/dev/null 2>&1; then
    echo "mutant $1: SURVIVED (tests did not catch it)"; return 1
  fi
  echo "mutant $1: killed"
}

echo "== mutants"
rc=0
mutate drop-length-check   's/if (len == 0 || len > UFO_CMD_MAX) return false;      \/\/ before any copy/if (len == 0) return false;/' || rc=1
mutate drop-allowlist      's/  return ufoCmdAllowed(out);/  return true;/' || rc=1
mutate drop-printable      's/if (ch < 0x20 || ch > 0x7e) return false;/if (0) return false;/' || rc=1
mutate drop-topic          's/if (topic == nullptr || strcmp(topic, UFO_CMD_TOPIC) != 0) return false;/if (topic == nullptr) return false;/' || rc=1
mutate cap-100             's/static const int NET_CAP_MAX = 60;/static const int NET_CAP_MAX = 100;/' || rc=1
mutate drop-mode-cooldown  's/if (modeArmed \&\& nowMs - lastMode < MODE_COOLDOWN_MS) return REFUSE;/if (0) return REFUSE;/' || rc=1
mutate drop-idle-only      's/if (!idleCalm) return REFUSE;/if (0) return REFUSE;/' || rc=1
mutate drop-strips-cooldown 's/if (stripsArmed \&\& nowMs - lastStrips < STRIPS_COOLDOWN_MS) return REFUSE;/if (0) return REFUSE;/' || rc=1
mutate cap-window          's/MODE_COOLDOWN_MS = 2000, STRIPS_COOLDOWN_MS = 2000, CAP_WINDOW_MS = 334;/MODE_COOLDOWN_MS = 2000, STRIPS_COOLDOWN_MS = 2000, CAP_WINDOW_MS = 10;/' || rc=1
mutate bucket-rate         's/float tokens = 8, rate = 5, cap = 8;/float tokens = 8, rate = 50, cap = 8;/' || rc=1
mutate no-ramp             's/static const float RAMP_PER_S = 1.2f;/static const float RAMP_PER_S = 1000.0f;/' || rc=1
mutate allow-T             "s/      case '?': o = {UK_STATUS, 0}; return true;/      case '?': o = {UK_STATUS, 0}; return true; case 'T': o = {UK_STATUS, 0}; return true;/" || rc=1
mutate leading-zero        "s/if (d\[0\] == '0' \&\& d\[1\] != 0) return false;/if (0) return false;/" || rc=1
mutate gap-range           's/if (ufoNum(d, 120, 900, v))/if (ufoNum(d, 100, 999, v))/' || rc=1
mutate drop-calm-spin      's/st.ev == EV_NONE \&\& st.spin < 0.2f \&\& !pending.hasMode/st.ev == EV_NONE \&\& !pending.hasMode/' || rc=1
exit $rc
