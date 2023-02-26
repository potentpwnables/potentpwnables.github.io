---
title: Solving CyberDefenders' Bucket Challenge
author: ''
date: '2023-02-26'
slug: cyber-defenders-bucket-challenge
categories: []
tags:
  - ctf
  - cyberdefenders
  - aws
  - python
type: ''
subtitle: ''
image: ''
readtime: true
---

This is a simple write up for the first challenge I attempted on [CyberDefenders](https://cyberdefenders.org), which can be found [here](https://cyberdefenders.org/blueteam-ctf-challenges/84#nav-questions).

###### Instructions
Use the provided credentials to access AWS cloud trail logs and answer the questions.

###### Scenario
Welcome, Defender! As an incident responder, we're granting you access to the AWS account called "Security" as an IAM user. This account contains a copy of the logs during the time period of the incident and has the ability to assume the "Security" role in the target account so you can look around to spot the misconfiguration that allowed for this attack to happen.

###### Environment
The credentials above give you access to the Security account, which can assume the role of "security" in the Target account. You also have acces to an S3 bucket, named flaws2_logs, in the Security account, that contains the CloudTrail logs recorded during a successful compromise. 

###### Questions
1. What is the full AWS CLI command used to configure credentials?
2. What is the 'creation' date of the bucket 'flaws2-logs'?
3. What is the name of the first generated event according to time?
4. What source IP address generated the vent dated 2018-11-28 at 23:03:20 UTC?
5. Which IP address does not belong to Amazon AWS infrastructure?
6. Which user issued the 'ListBuckets' request?
7. What was the first request issued by the user 'level1'?

###### Question 1

This question can be answered by reading [the docs](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html). The answer is `aws configure`.

###### Question 2

This question can be answered by logging into the AWS portal with the credentials provided in the challenge, navigating to the S3 Buckets dashboard, and observing the metadata provided for the `flaws2-logs` bucket. Note that the creation time displayed is, at least for me, in Eastern Time (UTC -5:00), so some simple arithmetic is needed to get it into the UTC time zone requested by the answer. The answer is `2018-11-19 20:54:31 UTC`.

###### Environment Setup

The following questions will be answered by analyzing the data in Python. So let's load some packages, read in the data, and convert all of the logs to a single Pandas dataframe.


```python
import pandas as pd
import os
import json

files = os.listdir(".")
files = [file for file in files if file.endswith(".json")]

data = []
for file in files:
    with open(file, "r") as f:
        data.append(json.load(f))
        
for datum in data[1:]:
    data[0]["Records"].extend(datum["Records"])

df = pd.DataFrame(data=data[0]["Records"])
df.head()
```

<div style="overflow-x: auto;">
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>eventVersion</th>
      <th>userIdentity</th>
      <th>eventTime</th>
      <th>eventSource</th>
      <th>eventName</th>
      <th>awsRegion</th>
      <th>sourceIPAddress</th>
      <th>userAgent</th>
      <th>requestParameters</th>
      <th>responseElements</th>
      <th>...</th>
      <th>requestID</th>
      <th>eventID</th>
      <th>readOnly</th>
      <th>resources</th>
      <th>eventType</th>
      <th>recipientAccountId</th>
      <th>sharedEventID</th>
      <th>errorCode</th>
      <th>errorMessage</th>
      <th>managementEvent</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1.05</td>
      <td>{'type': 'AWSAccount', 'principalId': '', 'acc...</td>
      <td>2018-11-28T23:09:36Z</td>
      <td>s3.amazonaws.com</td>
      <td>GetObject</td>
      <td>us-east-1</td>
      <td>104.102.221.250</td>
      <td>[Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_...</td>
      <td>{'bucketName': 'the-end-962b72bjahfm5b4wcktm8t...</td>
      <td>None</td>
      <td>...</td>
      <td>EDFBFC9CE11E755F</td>
      <td>ea33682d-0829-40c1-9820-bd721b9aede8</td>
      <td>True</td>
      <td>[{'type': 'AWS::S3::Object', 'ARN': 'arn:aws:s...</td>
      <td>AwsApiCall</td>
      <td>653711331788</td>
      <td>a59b4ac8-6a51-44ff-ab76-e66f75bd95ce</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>1</th>
      <td>1.05</td>
      <td>{'type': 'AWSAccount', 'principalId': '', 'acc...</td>
      <td>2018-11-28T23:09:36Z</td>
      <td>s3.amazonaws.com</td>
      <td>GetObject</td>
      <td>us-east-1</td>
      <td>104.102.221.250</td>
      <td>[Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_...</td>
      <td>{'bucketName': 'the-end-962b72bjahfm5b4wcktm8t...</td>
      <td>None</td>
      <td>...</td>
      <td>9880010F3D39F3AC</td>
      <td>dee6f6a3-f18a-40db-a6fd-b96d05502266</td>
      <td>True</td>
      <td>[{'type': 'AWS::S3::Object', 'ARN': 'arn:aws:s...</td>
      <td>AwsApiCall</td>
      <td>653711331788</td>
      <td>f8c6cdc8-6ec1-4e14-9a0e-f300b16e282e</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>2</th>
      <td>1.05</td>
      <td>{'type': 'AWSService', 'invokedBy': 'ecs-tasks...</td>
      <td>2018-11-28T22:31:59Z</td>
      <td>sts.amazonaws.com</td>
      <td>AssumeRole</td>
      <td>us-east-1</td>
      <td>ecs-tasks.amazonaws.com</td>
      <td>ecs-tasks.amazonaws.com</td>
      <td>{'roleSessionName': 'd190d14a-2404-45d6-9113-4...</td>
      <td>{'credentials': {'sessionToken': 'FQoGZXIvYXdz...</td>
      <td>...</td>
      <td>6b7d6c60-f35d-11e8-becc-39e7d43d4afe</td>
      <td>6177ca7e-860e-482c-bde9-50c735af58d6</td>
      <td>NaN</td>
      <td>[{'ARN': 'arn:aws:iam::653711331788:role/level...</td>
      <td>AwsApiCall</td>
      <td>653711331788</td>
      <td>1d18bf74-8392-4496-9dc4-a45cb799b8b4</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>3</th>
      <td>1.05</td>
      <td>{'type': 'AWSService', 'invokedBy': 'ecs-tasks...</td>
      <td>2018-11-28T22:31:59Z</td>
      <td>sts.amazonaws.com</td>
      <td>AssumeRole</td>
      <td>us-east-1</td>
      <td>ecs-tasks.amazonaws.com</td>
      <td>ecs-tasks.amazonaws.com</td>
      <td>{'roleSessionName': 'd190d14a-2404-45d6-9113-4...</td>
      <td>{'credentials': {'sessionToken': 'FQoGZXIvYXdz...</td>
      <td>...</td>
      <td>6b80a0b1-f35d-11e8-becc-39e7d43d4afe</td>
      <td>457af3a9-0b1b-44ca-91e1-8f4a0f873149</td>
      <td>NaN</td>
      <td>[{'ARN': 'arn:aws:iam::653711331788:role/ecsTa...</td>
      <td>AwsApiCall</td>
      <td>653711331788</td>
      <td>5397e1a9-82c7-4a00-9b1c-e44cbd688aa1</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>4</th>
      <td>1.04</td>
      <td>{'type': 'AssumedRole', 'principalId': 'AROAIB...</td>
      <td>2018-11-28T23:06:17Z</td>
      <td>ecr.amazonaws.com</td>
      <td>BatchGetImage</td>
      <td>us-east-1</td>
      <td>104.102.221.250</td>
      <td>aws-cli/1.16.19 Python/2.7.10 Darwin/17.7.0 bo...</td>
      <td>{'imageIds': [{'imageTag': 'latest'}], 'reposi...</td>
      <td>None</td>
      <td>...</td>
      <td>35ea9256-f362-11e8-86cf-35c48074ab0a</td>
      <td>b2867f3e-810c-47d1-9657-edb886e03fe6</td>
      <td>NaN</td>
      <td>[{'ARN': 'arn:aws:ecr:us-east-1:653711331788:r...</td>
      <td>AwsApiCall</td>
      <td>653711331788</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
  </tbody>
</table>
<p>5 rows × 21 columns</p>
</div>

<br/>

###### Question 3


```python
df.sort_values("eventTime", ascending=True, ignore_index=True).loc[0, "eventName"]
```

This gives us a value of `AssumeRole`, which is our answer.



###### Question 4


```python
df.query("eventTime == '2018-11-28T23:03:20Z'")
```


<div style="overflow-x: auto;">
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>eventVersion</th>
      <th>userIdentity</th>
      <th>eventTime</th>
      <th>eventSource</th>
      <th>eventName</th>
      <th>awsRegion</th>
      <th>sourceIPAddress</th>
      <th>userAgent</th>
      <th>requestParameters</th>
      <th>responseElements</th>
      <th>...</th>
      <th>requestID</th>
      <th>eventID</th>
      <th>readOnly</th>
      <th>resources</th>
      <th>eventType</th>
      <th>recipientAccountId</th>
      <th>sharedEventID</th>
      <th>errorCode</th>
      <th>errorMessage</th>
      <th>managementEvent</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>9</th>
      <td>1.04</td>
      <td>{'type': 'AssumedRole', 'principalId': 'AROAIB...</td>
      <td>2018-11-28T23:03:20Z</td>
      <td>logs.amazonaws.com</td>
      <td>CreateLogStream</td>
      <td>us-east-1</td>
      <td>34.234.236.212</td>
      <td>awslambda-worker</td>
      <td>None</td>
      <td>None</td>
      <td>...</td>
      <td>cc9ae337-f361-11e8-894e-cbc2b0778d92</td>
      <td>483557d2-2b35-4fc6-b682-ff5dbc96eccf</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>AwsApiCall</td>
      <td>653711331788</td>
      <td>NaN</td>
      <td>AccessDenied</td>
      <td>User: arn:aws:sts::653711331788:assumed-role/l...</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>36</th>
      <td>1.06</td>
      <td>{'type': 'AWSService', 'invokedBy': 'apigatewa...</td>
      <td>2018-11-28T23:03:20Z</td>
      <td>lambda.amazonaws.com</td>
      <td>Invoke</td>
      <td>us-east-1</td>
      <td>apigateway.amazonaws.com</td>
      <td>apigateway.amazonaws.com</td>
      <td>{'functionName': 'arn:aws:lambda:us-east-1:653...</td>
      <td>None</td>
      <td>...</td>
      <td>cc96765b-f361-11e8-a2d8-2b201bd316c5</td>
      <td>949e83c0-0d98-4b7d-8845-5e2fe3eafde4</td>
      <td>False</td>
      <td>[{'accountId': '653711331788', 'type': 'AWS::L...</td>
      <td>AwsApiCall</td>
      <td>653711331788</td>
      <td>a63b106b-e331-4778-a6c0-64e397216fde</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>False</td>
    </tr>
  </tbody>
</table>
<p>2 rows × 21 columns</p>
</div>

Two results are returned, but the answer is obviously `34.234.236.212`.

###### Question 5


```python
(
    df
    .groupby(["sourceIPAddress", "userAgent"])
    .size()
)
```




    sourceIPAddress           userAgent                                                                                                                  
    104.102.221.250           [Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36]    22
                              [aws-cli/1.16.19 Python/2.7.10 Darwin/17.7.0 botocore/1.12.9]                                                                   2
                              aws-cli/1.16.19 Python/2.7.10 Darwin/17.7.0 botocore/1.12.9                                                                     3
    34.234.236.212            awslambda-worker                                                                                                                5
    apigateway.amazonaws.com  apigateway.amazonaws.com                                                                                                        2
    ecs-tasks.amazonaws.com   ecs-tasks.amazonaws.com                                                                                                         2
    lambda.amazonaws.com      lambda.amazonaws.com                                                                                                            1
    dtype: int64



There is only one IP address whose User Agent string does not mention AWS, which is `104.102.221.250`.

###### Question 6


```python
df.query("eventName == 'ListBuckets'")['userIdentity'].values
```




    array([{'type': 'AssumedRole', 'principalId': 'AROAJQMBDNUMIKLZKMF64:d190d14a-2404-45d6-9113-4eda22d7f2c7', 'arn': 'arn:aws:sts::653711331788:assumed-role/level3/d190d14a-2404-45d6-9113-4eda22d7f2c7', 'accountId': '653711331788', 'accessKeyId': 'ASIAZQNB3KHGNXWXBSJS', 'sessionContext': {'attributes': {'mfaAuthenticated': 'false', 'creationDate': '2018-11-28T22:31:59Z'}, 'sessionIssuer': {'type': 'Role', 'principalId': 'AROAJQMBDNUMIKLZKMF64', 'arn': 'arn:aws:iam::653711331788:role/level3', 'accountId': '653711331788', 'userName': 'level3'}}}],
          dtype=object)



The last key in the JSON data is `userName`, which has a value of `level3`, which is our answer.

###### Question 7


```python
(
    df
    .loc[df["userIdentity"].astype(str).str.contains("level1")]
    .sort_values("eventTime", ascending=True, ignore_index=True)
    .loc[0, "eventName"]
)
```

The answer is `CreateLogStream`.


