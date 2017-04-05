FROM continuumio/miniconda
RUN apt-get update -y
COPY . /app
WORKDIR /app
RUN conda config --add channels SciTools
RUN conda config --add channels conda-forge
RUN conda config --add channels ioam
RUN conda create -n api --file conda-requirements.txt
RUN /bin/bash -c "source activate api; pip install ."

EXPOSE 5000

CMD /bin/bash -c "source activate api; python3 bot/app.py"
