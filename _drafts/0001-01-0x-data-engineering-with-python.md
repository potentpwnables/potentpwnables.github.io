---
title: Data Engineering with Python
author: ''
date: '2021-07-11'
slug: data-engineering-with-python
categories: []
tags:
  - python
  - airflow
  - docker
  - ELK
type: ''
subtitle: ''
image: ''
---

I recently made my way through the book [_Data Engineering with Python_](https://www.packtpub.com/product/data-engineering-with-python/9781839214189) by Paul Crickard and wanted to document my process, both for the sake of sharing what I learned as well as discussing some changes I made to the way Paul outlines this workflow in his book. The whole purpose of going through this book was to undertake a new side project to help me learn more about data engineering, and while the book already lays out a great foundation for doing so, I thought that I could add to the learning experience by making a couple of small changes as I approached the project. The first change that I made was to remove Apache Nifi from the equation. Paul introduces both [Nifi](https://nifi.apache.org/) and [Airflow](https://airflow.apache.org/) during the chapter on installing the infrastructure, but then seems to only reference Airflow in passing throughout the remainder of the book, likely due to the fact that Nifi and Airflow have a large overlap in functionality. Because of the fact that the workflow is so clearly laid out for Nifi, I thought it would be more challenging to do it solely using Airflow, thus improving my learning experience. There are also a couple of things that immediately turned me off from Nifi, which I'll discuss below. The second change I made was to incorporate Docker. In the chapter on setting up your infrastructure, Paul walks through how to install everything on a single machine, which could just as easily be either your computer, a virtual machine, or a server hosted in the cloud, but I thought the setup provided a perfect opportunity to learn Docker given the clear separation of services. So, with that all being said, let's dive into the set up.

# Setting up the Infrastructure
#### Docker

#### Airflow
# Extending the image

#### Why Not Nifi
# Jython
# Flows file didn't work as nicely with Docker

#### PostgreSQL & Redis
# Just here to make Airflow happy

#### Elasticsearch
# Setting ES_JAVA_OPTS=-Xms512m -Xmx512m
# using bulk helpers
# writing the upsert functionality in python
# getting airflow to talk to elasticsearch

#### Kibana

# Setting Up the Pipeline
# The need for two DAGs
# Bernadino County vs Manhattan County
# Historical vs Current Records
# @once vs @daily

# Setting up the Dashboard

# Porting it to the Cloud
