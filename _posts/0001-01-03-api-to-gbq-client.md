---
title: Piping API Data To Google Big Query Using Python - Part III
author: ''
date: '2020-07-02'
slug: piping-api-to-gbq-python-part-iii
categories: []
tags:
  - python
  - api
  - bigquery
type: ''
subtitle: ''
image: ''
---

This is the final installment of a three-part blog post:
* [Setting up the Infrastructure](https://tibblesnbits.com/2020/piping-api-to-gbq-python-part-i)  
* [Building the API](https://tibblesnbits.com/2020/piping-api-to-gbq-python-part-ii)
* [Piping it to Google BigQuery](https://tibblesnbits.com/2020/piping-api-to-gbq-python-part-iii)

In the prior posts we walked through downloading the data that we needed as well as setting it up into a database that our API could pull from. We then stepped through the process of building an API using Flask and creating a single endpoint that would give users access to the database we built and return the results as either JSON or XML. In this post, we'll write a script that connects to the database and streams the results from the API, through Python, into Google's BigQuery (GBQ). 

As I stated in the prior posts, this series isn't meant to be an in-depth tutorial on all of the things involved. As a result, I won't be walking through how to set up GBQ. However, you can find some decent documentation on using GBQ [here](https://cloud.google.com/bigquery/docs/quickstarts/quickstart-web-ui), and how to use it inside of Python [here](https://cloud.google.com/bigquery/docs/quickstarts/quickstart-client-libraries). Additionally, you can go [here](https://console.cloud.google.com/flows/enableapi?apiid=bigquery) to begin creating a GBQ project. Lastly, to make following along more seamless, I'd recommend naming your project "api2gbq", your database "LANL", and your table "flows".  With all of that being said, let's get started.

#### Installing the necessary modules
There are four main modules that we'll be working with in our script, which are `requests`, `lxml`, `json`, and `google.cloud`. The first is for connecting to our API and getting the data, the second is for parsing the XML that is returned, the third is for formatting the data into a format GBQ can use, and the fourth is for pushing the data to GQB. `requests` and `json` are already installed with Python, but we'll need to install the other two. To do that, run the following at the terminal:

```
pip3 install --upgrade google-cloud-bigquery
pip3 install lxml
```

You should pop into Python from the terminal really quick and just make sure that you can import all of the necessary modules. We can do this and also set up the skeleton of our script simultaneously, so let's create a file called api_to_gqb.py and add the following lines of code.

```python
from google.cloud import bigquery
from xml import etree
import requests
import json

def main():
  print("Modules imported successfully!")
  
if __name__ == "__main__":
  main()
```

Save the file and run it from your terminal with `python3 api_to_gbq.py`. Assuming the print statement works, we're good to go.

#### Connecting to the API
The next step is to connect to the API and make sure that we're reading our data in. But this is also a good point to take a second to explain our approach. If you read the first blog in this series, you'll know that the machine I'm using to pull this data isn't that big of a machine. It's a dual-core CPU with 4 GB of RAM. I'm intentionally constraining myself because I want to show how this can be done with minimal resources since we're never storing a large amount of data in memory. We'll stream the data in and handle it as it comes in, parsing the records and getting them ready to send to GBQ. What this means is that we don't want to download all of the data at once, which is why we setup the API to send the results as soon as it had them, instead of waiting for all of the results to be ready. So let's connect to the API and start getting some results.

```python
def main():
  url = "http://192.168.1.13:5000/api/v1/stream/flows" # change the IP to whatever your server's IP is
  params = {
    "scanned_after": 0,
    "scanned_before": 1,
    "format": "xml",
    "limit": 10
  }
  for i,chunk in enumerate(requests.request("GET", url, params=params)):
    print(i, chunk.decode("utf-8"))
```

The first couple of lines should be relatively self explanatory. We set `url` to the endpoint that we want to connect to, and then we define a variable called params that holds the API parameters we want to pass. We'll be returning the first 10 records in our data as XML format. The next line is where all of the magic happens. We'll be using the `request` method from the `requests` module to stream the results in via the GET method, and we'll pass our dictionary of parameters to the params field so that `requests` will append them to our URL. We're also going to enumerate over the data chunks that are returned to help us get a better picture of how the data is coming back. We also need to decode the chunks that come back because they'll be in byte format (represented as `b'...'`). So with this code in place, let's run our script. You should get something that looks like the following:

```
0 <?xml version='1.0' encoding='UTF-8'?><records><record><id>1</id><time>1</time><duration>0</duration><src_comp>C1065</src_comp><
1 src_port>389</src_port><dst_comp>C3799</dst_comp><dst_port>N10451</dst_port><protocol>6</protocol><packet_count>10</packet_count
2 ><byte_count>5323</byte_count></record>
<record><id>2</id><time>1</time><duration>0</duration><src_comp>C1423</src_comp><src_por
3 t>N1136</src_port><dst_comp>C1707</dst_comp><dst_port>N1</dst_port><protocol>6</protocol><packet_count>5</packet_count><byte_cou
4 nt>847</byte_count></record>
<record><id>3</id><time>1</time><duration>0</duration><src_comp>C1423</src_comp><src_port>N1142</sr
5 c_port><dst_comp>C1707</dst_comp><dst_port>N1</dst_port><protocol>6</protocol><packet_count>5</packet_count><byte_count>847</byt
6 e_count></record>
<record><id>4</id><time>1</time><duration>0</duration><src_comp>C14909</src_comp><src_port>N8191</src_port><ds
7 t_comp>C5720</dst_comp><dst_port>2049</dst_port><protocol>6</protocol><packet_count>1</packet_count><byte_count>52</byte_count><
8 /record>
<record><id>5</id><time>1</time><duration>0</duration><src_comp>C14909</src_comp><src_port>N8192</src_port><dst_comp>C5
9 720</dst_comp><dst_port>2049</dst_port><protocol>6</protocol><packet_count>1</packet_count><byte_count>52</byte_count></record>

10 <record><id>6</id><time>1</time><duration>0</duration><src_comp>C14909</src_comp><src_port>N8193</src_port><dst_comp>C5720</dst_
11 comp><dst_port>2049</dst_port><protocol>6</protocol><packet_count>1</packet_count><byte_count>52</byte_count></record>
<record><
12 id>7</id><time>1</time><duration>0</duration><src_comp>C1707</src_comp><src_port>N1</src_port><dst_comp>C1423</dst_comp><dst_por
13 t>N1136</dst_port><protocol>6</protocol><packet_count>4</packet_count><byte_count>414</byte_count></record>
<record><id>8</id><t
14 ime>1</time><duration>0</duration><src_comp>C1707</src_comp><src_port>N1</src_port><dst_comp>C1423</dst_comp><dst_port>N1142</ds
15 t_port><protocol>6</protocol><packet_count>4</packet_count><byte_count>413</byte_count></record>
<record><id>9</id><time>1</time
16 ><duration>0</duration><src_comp>C1707</src_comp><src_port>N1</src_port><dst_comp>C925</dst_comp><dst_port>N10487</dst_port><pro
17 tocol>6</protocol><packet_count>4</packet_count><byte_count>414</byte_count></record>
<record><id>10</id><time>1</time><duration
18 >0</duration><src_comp>C1707</src_comp><src_port>N1</src_port><dst_comp>C925</dst_comp><dst_port>N10491</dst_port><protocol>6</p
19 rotocol><packet_count>4</packet_count><byte_count>413</byte_count></record></records>
```

The first thing you notice might be that there are 20 lines that are printed, even though we only requested 10 records. The next thing you might realize is that this is because the API isn't sending us the data in chunk sizes large enough to hold an entire record. Instead, it sends as much data as it can in each packet, and continues to send packets until all 10 records have been sent. At this point, you might be asking yourself "is that how all APIs work?". I was certainly asking myself that question. So to check, I connected to the Twitter API and decided to see for myself, and as you can see in the image below, that's exactly how it works.

![twitter_api](/img/twitter_stream.png)

This of course means that I'll at some point go and read through tweepy's documentation (one of the most popular Python modules for interacting with Twitter) to see how they handle interacting with data like this, but for now we'll implement our own solution.

Because our data flows in like this, we need to do a couple of things:

1. Continue grabbing data until we have a full record, and  
2. Get rid of data that we've already processed, without getting rid of data we haven't.

#### Building our Buffer
In order to do this, we're going to build a buffer that will hold the data that has been sent to us thus far, and we'll continuously check that buffer to see if it contains a full record. Additionally, because we'll need to use the buffer in a couple of different functions, we'll make it a global variable so we can avoid passing it around to the functions that'll need it. So let's add this code to our file, which I'll include in its entirety below.

```python
from google.cloud import bigquery
from lxml import etree
import requests
import json

bfr = "" # this is our buffer; turns out buffer is a reserved word

def main():
  global bfr
  
  url = "http://192.168.1.13:5000/api/v1/stream/flows" # remember to change the IP
  params = {
    "scanned_after": 0,
    "scanned_before": 1,
    "limit": 10,
    "format": "xml"
  }
  for i,chunk in enumerate(requests.request("GET", url, params=params)):
    bfr += chunk.decode("utf-8")
    print(i, bfr)
    
if __name__ == "__main__":
  main()
```

Save the file and run it in the terminal. You should see your buffer grow with each iteration of the loop, and you should see that the final iteration contains all of the results. What this code is doing is looping over the chunks of data that the server sends to us and keeps appending those chunks to `bfr`. Within `main`, we have to specify that `bfr` refers to the global variable so that it doesn't try to create a local version of it. In each iteration, once we've appended the new chunk of data, we'll print the whole buffer.

#### Process the Buffer
This is great, but it's not avoiding the problem we're trying to avoid, which is that we don't want to hold all of our data in memory. Once we have a full record, we want to process it and get rid of it. To do that, we need a function that can analyze our buffer and process a record once it finds that a whole record exists. So let's create a function that can do that, which we'll put just above our `main` function.

```python
def process_xml_buffer():
  global bfr
  try:
    start = bfr.index("<record>")
    end = bfr.index("</record>")
    record = bfr[start:(end + 9)]
    bfr = bfr[(end + 9):]
    return record
  except ValueError:
    return None
```

So let's look at what this function is doing. It of course tells Python that it wants to use the global version of `bfr`, but then it immediately goes into a `try/except` setup. The reason for this is that if we try to find the index of something that doesn't exist, such as "</record>", it'll throw a `ValueError`. Because of this, we know that we'll want to catch the `ValueError` and handle it by just returning `None`, which will be helpful in a bit. Assuming that we find both strings we're looking for, "&lt;record>" and "&lt;/record>", we'll know that we have a full record that we can process. So, we extract all of the data between those two tags, including the tags themselves, and return that as `record`. In order to actually see these results, we need to collect the output from the function call and print it to the console. To do this, we'll modify our `main` function.

```python
def main():
  global bfr
  
  url = "http://192.168.1.13:5000/api/v1/stream/flows" # remember to change the IP
  params = {
    "scanned_after": 0,
    "scanned_before": 1,
    "limit": 10,
    "format": "xml"
  }
  for i,chunk in enumerate(requests.request("GET", url, params=params)):
    bfr += chunk.decode("utf-8")
    data = []
    while data is not None:
      data = process_xml_buffer()
      if data:
        print(i, data)
```

As you can see, we're no longer printing the buffer. Instead, we start by adding the new chunk to our buffer. We then reset/initialize `data` to be an empty list. It doesn't really matter what we set `data` to be, as long as we don't set it to `None` and we do set it something. The purpose here is that we need `data` to be defined before we get to the while loop. The while loop's constraint is based on `data` being `None`, which we've coded to only happen once `process_xml_buffer` has run and determined that no full records exist yet. If a full record does exist, `data` will be set to a string that contains the full record. Therefore, when we get to the next line `if data:`, we know that `data` is either `None` or a string with a record in it. If it doesn't contain a record, it skips this step, goes back to the top of the while loop, which acknowledges that `data == None`, exits the while loop, goes to the top of the for loop, and gets another chunk of data, thereby starting the next iteration of the loop.

However, if `data` _does_ contain a record, it gets printed out, and the script goes back to the top of the while loop. Because `data` is not `None`, the script will try to process the buffer again, without adding any new data to it. The reason for this is that we want to make sure that if we have two records that exist in the buffer we process both of them before adding more data to it. This ensures that all records are processed. Once we've determined that no more records exist in the current buffer, we exit the while loop, go to the top of the for loop, and add more data to the buffer.

If you save your file and run it in the terminal, assuming everything is set up right, you should see the following output.

```
2 <record><id>1</id><time>1</time><duration>0</duration><src_comp>C1065</src_comp><src_port>389</src_port><dst_comp>C3799</dst_comp><dst_port>N10451</dst_port><protocol>6</protocol><packet_count>10</packet_count><byte_count>5323</byte_count></record>
4 <record><id>2</id><time>1</time><duration>0</duration><src_comp>C1423</src_comp><src_port>N1136</src_port><dst_comp>C1707</dst_comp><dst_port>N1</dst_port><protocol>6</protocol><packet_count>5</packet_count><byte_count>847</byte_count></record>
6 <record><id>3</id><time>1</time><duration>0</duration><src_comp>C1423</src_comp><src_port>N1142</src_port><dst_comp>C1707</dst_comp><dst_port>N1</dst_port><protocol>6</protocol><packet_count>5</packet_count><byte_count>847</byte_count></record>
8 <record><id>4</id><time>1</time><duration>0</duration><src_comp>C14909</src_comp><src_port>N8191</src_port><dst_comp>C5720</dst_comp><dst_port>2049</dst_port><protocol>6</protocol><packet_count>1</packet_count><byte_count>52</byte_count></record>
9 <record><id>5</id><time>1</time><duration>0</duration><src_comp>C14909</src_comp><src_port>N8192</src_port><dst_comp>C5720</dst_comp><dst_port>2049</dst_port><protocol>6</protocol><packet_count>1</packet_count><byte_count>52</byte_count></record>
11 <record><id>6</id><time>1</time><duration>0</duration><src_comp>C14909</src_comp><src_port>N8193</src_port><dst_comp>C5720</dst_comp><dst_port>2049</dst_port><protocol>6</protocol><packet_count>1</packet_count><byte_count>52</byte_count></record>
13 <record><id>7</id><time>1</time><duration>0</duration><src_comp>C1707</src_comp><src_port>N1</src_port><dst_comp>C1423</dst_comp><dst_port>N1136</dst_port><protocol>6</protocol><packet_count>4</packet_count><byte_count>414</byte_count></record>
15 <record><id>8</id><time>1</time><duration>0</duration><src_comp>C1707</src_comp><src_port>N1</src_port><dst_comp>C1423</dst_comp><dst_port>N1142</dst_port><protocol>6</protocol><packet_count>4</packet_count><byte_count>413</byte_count></record>
17 <record><id>9</id><time>1</time><duration>0</duration><src_comp>C1707</src_comp><src_port>N1</src_port><dst_comp>C925</dst_comp><dst_port>N10487</dst_port><protocol>6</protocol><packet_count>4</packet_count><byte_count>414</byte_count></record>
19 <record><id>10</id><time>1</time><duration>0</duration><src_comp>C1707</src_comp><src_port>N1</src_port><dst_comp>C925</dst_comp><dst_port>N10491</dst_port><protocol>6</protocol><packet_count>4</packet_count><byte_count>413</byte_count></record>
```

You should notice that this time only 10 rows are printed to the console, and each row contains a full record. You should also notice that the number printed at the start of each line, which is our for loop counter, is not sequential. This means that we're not finding a record on every line, which is what we expect. 

#### Convert the Data
At this point, we've successfully handled the streaming nature of the inbound data, and have successfully isolated the individual records from the buffer. Our next step is to conver it from an XML-like string to a JSON-like object (aka `dict`) so that we can pass it to GBQ.

```python
def xml_to_dict(record):
  root = etree.fromstring(record)
  d = {}
  cols = [
    "id", 
    "time", 
    "duration", 
    "src_comp", 
    "src_port", 
    "dst_comp",
    "dst_port",
    "protocol",
    "packet_count",
    "byte_count"]
  for col in cols:
    value = root.find(f".//{col}").text
    if col in ["id", "time", "duration", "packet_count", "byte_count"]:
      d[col] = int(value) if value is not None else None
    else:
      d[col] = value
  return d
```

The `etree` function from `lxml` is able to take an XML snippet and parse it as an XML DOM that can be navigated with xpath. This is perfect because it allows us to iterate through the elements we want to extract and add them to a `dict` object. The only downside is that because all of the values are contained within a string, they'll all be extract as a string. So we'll make sure to cast the appropriate values back to `int` while also acknowledging that if the element isn't found, it'll return `None`, which we'll also pass into `d`. Now that we have the data convertor built, we can implement in `process_xml_buffer`.

```python
def process_xml_buffer():
  global bfr
  try:
    start = bfr.index("<record>")
    end = bfr.index("</record>")
    record = bfr[start:(end + 9)]
    bfr = bfr[(end + 9):]
    return xml_to_dict(record)
  except ValueError:
    return None
```

Notice that the only thing we've changed is our `return` statement, which now calls our new function before returning the results. If we run our script now, we get this:

```
2 {'id': 1, 'time': 1, 'duration': 0, 'src_comp': 'C1065', 'src_port': '389', 'dst_comp': 'C3799', 'dst_port': 'N10451', 'protocol': '6', 'packet_count': 10, 'byte_count': 5323}
4 {'id': 2, 'time': 1, 'duration': 0, 'src_comp': 'C1423', 'src_port': 'N1136', 'dst_comp': 'C1707', 'dst_port': 'N1', 'protocol': '6', 'packet_count': 5, 'byte_count': 847}
6 {'id': 3, 'time': 1, 'duration': 0, 'src_comp': 'C1423', 'src_port': 'N1142', 'dst_comp': 'C1707', 'dst_port': 'N1', 'protocol': '6', 'packet_count': 5, 'byte_count': 847}
8 {'id': 4, 'time': 1, 'duration': 0, 'src_comp': 'C14909', 'src_port': 'N8191', 'dst_comp': 'C5720', 'dst_port': '2049', 'protocol': '6', 'packet_count': 1, 'byte_count': 52}
9 {'id': 5, 'time': 1, 'duration': 0, 'src_comp': 'C14909', 'src_port': 'N8192', 'dst_comp': 'C5720', 'dst_port': '2049', 'protocol': '6', 'packet_count': 1, 'byte_count': 52}
11 {'id': 6, 'time': 1, 'duration': 0, 'src_comp': 'C14909', 'src_port': 'N8193', 'dst_comp': 'C5720', 'dst_port': '2049', 'protocol': '6', 'packet_count': 1, 'byte_count': 52}
13 {'id': 7, 'time': 1, 'duration': 0, 'src_comp': 'C1707', 'src_port': 'N1', 'dst_comp': 'C1423', 'dst_port': 'N1136', 'protocol': '6', 'packet_count': 4, 'byte_count': 414}
15 {'id': 8, 'time': 1, 'duration': 0, 'src_comp': 'C1707', 'src_port': 'N1', 'dst_comp': 'C1423', 'dst_port': 'N1142', 'protocol': '6', 'packet_count': 4, 'byte_count': 413}
17 {'id': 9, 'time': 1, 'duration': 0, 'src_comp': 'C1707', 'src_port': 'N1', 'dst_comp': 'C925', 'dst_port': 'N10487', 'protocol': '6', 'packet_count': 4, 'byte_count': 414}
19 {'id': 10, 'time': 1, 'duration': 0, 'src_comp': 'C1707', 'src_port': 'N1', 'dst_comp': 'C925', 'dst_port': 'N10491', 'protocol': '6', 'packet_count': 4, 'byte_count': 413}
```

It's worth pointing out that this script is choosing to only convert the XML to JSON and return it back to `main`. However, if there were things that needed to be done to the data before it was ready to be pushed to GBQ, you could include that in `process_xml_buffer`. Say, for example, we wanted to append a variable that told which day the data was from. Since `time` measures the number of seconds since point in time when the data collection started, we could use `time % 86401` to get the day (86401 because 86400 should be considered the last second of the first day). To do this, we could create a function and then call that function in `process_xml_buffer`.

```python
def calculate_day(time):
  return (time - (time % -86041)) / 86401
  
def process_xml_buffer():
  global bfr
  try:
    start = bfr.index("<record>")
    end = bfr.index("</record>")
    record = bfr[start:(end + 9)]
    bfr = bfr[(end + 9):]
    d = xml_to_dict(record)
    d["day"] = calculate_day(d["time"])
    return d
  except ValueError:
    return None
```

In our instance, however, we don't really have any processing that we need to do, so we won't add that functionality into the script. And now that we have our data in a JSON-like object, we're ready to start pushing everything to GBQ. 

#### Configure the GBQ Job
Now, in order to do this, you should have already created your project, a dataset (Google's name for database), and a table. As I said before, your project should be named "api2gbq", your dataset named "LANL", and your table named "flows". And with that, we're at another point where a quick digression makes sense. There will surely be a number of different opinions on how to approach this next step. The reason for this is that within the Qualys data, if a machine that has previously been scanned is scanned again and new data pops up, the query that is taking place today will contain a record for that machine, but so will the database since the machine was returned in a prior query. As it has been explained, there is no reason to maintain the old record, and all of the data should be updated with the new data. So this presents at least three options of which I'm aware:

1. Replace the existing record in the table, or  
2. Partition the table by date or time, or
3. Keep two tables, one as staging, one as prod, or  

I'm personally a fan of combining the second and third options. The way I see this working is like this: You've got your staging table, which holds all of the records you've ever queried for, parititoned by the day on which you queried for those records. The production table is dropped and recreated every night using the data from the staging table. Let's say you wanted to have a table of machines that were scanned in the last 30 days, and it should always have the most recent data. Because you have your staging table, which has all data, you could run a nightly query that runs the following SQL.

```sql
SELECT *
INTO machines
FROM machines_staging
WHERE _PARTITIONTIME >= '<DATE - 30 days>'
GROUP BY machine_id
HAVING _PARTITIONTIME == MAX(_PARTITIONTIME)
```

This would scan all of the data from last 30 days, return all of the records, group by `machine_id` (which is presumably unique) and return only the most recent record from the last 30 days. Any machines that have not been scanned in the last 30 days are excluded. Of course, GBQ doesn't allow you to use this method directly. Instead, we'd omit the `INTO machines` line and modify our query settings to set the destination table in there. The end result is the same.

Like I said, I'm sure lots of people will disagree with me on this. I'm not a database administrator by any definition of the title, so it's unlikely this is the best approach. But it should be feasible. So to achieve it, we'll need to create a second table within the same dataset. This one should be called "flows_staging" and should have the same schema as flows (all fields should be required, and all fields should be integers with the exception of src_comp, src_port, dst_comp, and dst_port). In the "Paritioning" drop-down box, choose "Paritition by ingestion time", and next to it check the box to force the parititioning filter. which will reduce the chances that you query the full table instead of just the partitions that you want. Lastly, choose "By day" as the paritioning type. 

Now that that's done, we need to implement the functionality in our script to connect to our table. The first thing we're going to do is connect to Google BigQuery. Again, with this not being a tutorial on GBQ, I won't be walking through how to set up an environment variable with your authentication keys, and I will assume that you have that done already. So our first step is connect to our project, dataset, and table. Within your `main` function, add the following lines of code.

```python
client = bigquery.Client(project="api2gbq") # or whatever you named your project
table = client.dataset("LANL").table("flows_staging") # or whatever you named your dataset and table
```

Assuming you've properly setup your `GOOGLE_APPLICATION_CREDENTIALS` environment variable; appropriately setup your project, created a dataset, and made a table; and used the right names in those two lines of code, your script should still be able to run without error after adding those two lines of code. Moving right along then, our next stop is to configure our "job". This will tell GBQ what type of actions we're going to be taking, namely uploading JSON data to a table. We'll do this by creating two new functions and adding a line in our main function.

```python
def config_job():
  table_schema = (
    {
      "name": "id",
      "type": "INTEGER",
      "mode": "REQUIRED"
    },
    {
      "name": "time",
      "type": "INTEGER",
      "mode": "REQUIRED"
    },
    {
      "name": "duration",
      "type": "INTEGER",
      "mode": "REQUIRED"
    },
    {
      "name": "src_comp",
      "type": "STRING",
      "mode": "REQUIRED"
    },
    {
      "name": "src_port",
      "type": "STRING",
      "mode": "REQUIRED"
    },
    {
      "name": "dst_comp",
      "type": "STRING",
      "mode": "REQUIRED"
    },
    {
      "name": "dst_port",
      "type": "STRING",
      "mode": "REQUIRED"
    },
    {
      "name": "protocol",
      "type": "INTEGER",
      "mode": "REQUIRED"
    },
    {
      "name": "packet_count",
      "type": "INTEGER",
      "mode": "REQUIRED"
    },
    {
      "name": "byte_count",
      "type": "INTEGER",
      "mode": "REQUIRED"
    }
  )
  job_config = bigquery.LoadJobConfig()
  job_config.source_format = bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
  job_config.schema = format_schema(table_schema)
  return job_config
  
def format_schema(schema):
  formatted_schema = []
  for var in schema:
    formatted = bigquery.SchemaField(var["name"], var["type"], var["mode"])
    formatted_schema.append(formatted)
  return formatted_schema
```

Within `main`, add the following line somewhere before the for loop.

```python
job_config = config_job()
```

#### Push it all to GBQ
The last thing we need to do is actually push this all to GBQ. In order to minimize our network IO, we're going to send our records in batches of 1,000. This is a small enough number of records that it won't bump up against our memory constraints, and it's 1/1000th the amount of network calls we have to make. For this, we're going to add some functionality to `main`.

```python
def main():
  global bfr
  
  url = "http://192.168.1.13:5000/api/v1/stream/flows" # remember to change the IP
  params = {
    "scanned_after": 0,
    "scanned_before": 2505600,
    "limit": 1000000,
    "format": "xml"
  }
  
  client = bigquery.Client(project="api2gbq")
  table = client.dataset("LANL").table("flows_staging")
  job_config = config_job()
  
  records = []
  for chunk in requests.request("GET", url, params=params):
    bfr += chunk.decode("utf-8")
    data = []
    while data is not None:
      data = process_xml_buffer()
      if data:
        records.append(data)
        if len(records) == 1000:
          job = client.load_table_from_json(records, table, job_config=job_config)
          records = []
```

We'll collect our records in a list, and when that list has 1,000 records we'll send 'em to GBQ. Notice also that I've bumped the limit up to 1,000,000 records, and have changed the scanned_before time to extend out to 29 days (86400 * 29). It's time to test what we've created. I'm going to post the code in full below, and assuming all goes well, you should be able to run that and see your data in your "flows_staging" table on GBQ (you might have to refresh the page). From there, it would be as simple as configuring GBQ to run a query every night that did as we described above to get the most relevant data into a table that could be used for a dashboard. But our work here is done. We have connected to an API, streamed the data into Python, processed it, and pushed it to GBQ.

#### Full Code

```python
from google.cloud import bigquery
from lxml import etree
import requests
import json

bfr = ""

def xml_to_dict(record):
  root = etree.fromstring(record)
  d = {}
  cols = [
    "id", 
    "time", 
    "duration", 
    "src_comp", 
    "src_port", 
    "dst_comp",
    "dst_port",
    "protocol",
    "packet_count",
    "byte_count"]
  for col in cols:
    value = root.find(f".//{col}").text
    if col in ["id", "time", "duration", "packet_count", "byte_count"]:
      d[col] = int(value) if value is not None else None
    else:
      d[col] = value
  return d
  
def process_xml_buffer():
  global bfr
  try:
    start = bfr.index("<record>")
    end = bfr.index("</record>")
    record = bfr[start:(end + 9)]
    bfr = bfr[(end + 9):]
    return xml_to_dict(record)
  except ValueError:
    return None
    
def config_job():
  table_schema = (
    {
      "name": "id",
      "type": "INTEGER",
      "mode": "REQUIRED"
    },
    {
      "name": "time",
      "type": "INTEGER",
      "mode": "REQUIRED"
    },
    {
      "name": "duration",
      "type": "INTEGER",
      "mode": "REQUIRED"
    },
    {
      "name": "src_comp",
      "type": "STRING",
      "mode": "REQUIRED"
    },
    {
      "name": "src_port",
      "type": "STRING",
      "mode": "REQUIRED"
    },
    {
      "name": "dst_comp",
      "type": "STRING",
      "mode": "REQUIRED"
    },
    {
      "name": "dst_port",
      "type": "STRING",
      "mode": "REQUIRED"
    },
    {
      "name": "protocol",
      "type": "INTEGER",
      "mode": "REQUIRED"
    },
    {
      "name": "packet_count",
      "type": "INTEGER",
      "mode": "REQUIRED"
    },
    {
      "name": "byte_count",
      "type": "INTEGER",
      "mode": "REQUIRED"
    }
  )
  job_config = bigquery.LoadJobConfig()
  job_config.source_format = bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
  job_config.schema = format_schema(table_schema)
  return job_config
  
def format_schema(schema):
  formatted_schema = []
  for var in schema:
    formatted = bigquery.SchemaField(var["name"], var["type"], var["mode"])
    formatted_schema.append(formatted)
  return formatted_schema
  
def main():
  global bfr
  
  url = "http://192.168.1.13:5000/api/v1/stream/flows" # remember to change the IP
  params = {
    "scanned_after": 0,
    "scanned_before": 1,
    "limit": 1000000,
    "format": "xml"
  }
  
  client = bigquery.Client(project="api2gbq")
  table = client.dataset("LANL").table("flows_staging")
  job_config = config_job()
  
  records = []
  for chunk in requests.request("GET", url, params=params):
    bfr += chunk.decode("utf-8")
    data = []
    while data is not None:
      data = process_xml_buffer()
      if data:
        records.append(data)
        if len(records) == 1000:
          job = client.load_table_from_json(records, table, job_config=job_config)
          records = []
          
if __name__ == "__main__":
  main()
```
