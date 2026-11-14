#!/bin/zsh
# usage: fetch_horizons.sh lon lat start stop step out
q() { curl -s -G "https://ssd.jpl.nasa.gov/api/horizons.api" \
  --data-urlencode "format=text" --data-urlencode "COMMAND='$1'" --data-urlencode "CENTER='coord@301'" \
  --data-urlencode "COORD_TYPE='GEODETIC'" --data-urlencode "SITE_COORD='$2,$3,0'" \
  --data-urlencode "START_TIME='$4'" --data-urlencode "STOP_TIME='$5'" --data-urlencode "STEP_SIZE='$6'" \
  --data-urlencode "QUANTITIES='4'" --data-urlencode "REF_SYSTEM='ICRF'" --data-urlencode "CSV_FORMAT='YES'" --data-urlencode "ANG_FORMAT='DEG'" --data-urlencode "APPARENT='AIRLESS'"; }
for body in 10 399; do q $body $1 $2 "$3" "$4" "$5" > "$6.$body.txt"; done
