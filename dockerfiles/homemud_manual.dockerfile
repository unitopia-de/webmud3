# 
# docker build --progress=plain -f dockerfiles/homemud_manual.dockerfile -t homemud .
# docker build --no-cache --progress=plain -f dockerfiles/homemud_manual.dockerfile -t homemud .

# _T\armageddon.dockerfile
FROM debian:bookworm

RUN apt-get update

RUN apt-get install -y --no-install-recommends build-essential ca-certificates git bison autoconf autogen automake wget pkg-config libgcrypt20-dev libgnutls28-dev libsqlite3-dev python3-dev libxml2-dev zlib1g-dev libpcre3-dev libc-ares-dev python3-hunspell hunspell-de-de locales \
 && echo "de_DE.UTF-8 UTF-8" > /etc/locale.gen \
 && dpkg-reconfigure --frontend=noninteractive locales \
 && update-locale LANG=de_DE.UTF-8

RUN git clone -b unitopia https://github.com/amotzkau/ldmud.git \
 && cd ldmud/src \
 && ./autogen.sh \
 && settings/unitopia --prefix=/usr/local \
 && make install-driver \
 && cd ../.. \
 && rm -rf ldmud

RUN mkdir /mud && cd /mud && mkdir /mud/lib \
 && cd /mud && wget -O - https://www.unitopia.de/pub/UNItopia/mudlib.tar.gz | tar -zxf - \
 && wget -O - https://www.unitopia.de/pub/UNItopia/muddocs.tar.gz | tar -zxf - \
 && wget -O - https://www.unitopia.de/pub/UNItopia/python-support.tar.gz | tar -zxf -

RUN apt-get clean \
 && apt-mark manual libgnutls30 libsqlite3-0 libpython3.11 libxml2 libpcre3 \
 && apt-get remove --purge -y build-essential ca-certificates git bison autoconf autogen automake wget pkg-config libgcrypt20-dev libgnutls28-dev libsqlite3-dev python3-dev libxml2-dev zlib1g-dev libpcre3-dev \
 && apt-get autoremove -y
RUN apt-get install -y procps tf net-tools

RUN /mud/lib/doc/driver/setup_mudlib

RUN mkdir mud9

ENV LANG=de_DE.UTF-8
ENV LC_ALL=de_DE.UTF-8

ADD dockerfiles/driver_full.sh /usr/local/bin/
ADD dockerfiles/.bashrc /root

EXPOSE 23 992 3333 3335/udp

# CMD [ "/usr/local/bin/driver_full.sh" ]
CMD [ "/bin/bash" ]

# run docker /bash) to copy mfrom mud to mud9 once (tail /root/.bashrc => copy2mud9) Adapt local path if applicable!
# docker run -it -p 23:23 -p 3333:3333 --name homemud --hostname homemud -v C:/_M/mud9:/mud9 docker.io/library/homemud

# run docker (bash) with local volume (adapt local path if applicable)
# docker run -it -p 23:23 -p 3333:3333 --name homemud --hostname homemud -v C:/_M/mud9:/mud docker.io/library/homemud
