#!/bin/bash
u="$1"
i=$(printf "%04d" "$2")
code=$(curl -s -m 25 -w '%{http_code}' -o "html/${i}.html" "$u")
echo "$i|$code|$u"
