---
title: Piping API Data To Google Big Query Using Python - Part II
author: ''
date: '2020-07-01'
slug: piping-api-to-gbq-python-part-ii
categories: []
tags:
  - python
  - api
  - bigquery
type: ''
subtitle: ''
image: ''
readtime: true
---

This is the second installment of a three-part blog post:
* [Setting up the Infrastructure](https://tibblesnbits.com/2020/piping-api-to-gbq-python-part-i)  
* [Building the API](https://tibblesnbits.com/2020/piping-api-to-gbq-python-part-ii)
* [Piping it to Google BigQuery](https://tibblesnbits.com/2020/piping-api-to-gbq-python-part-iii)

In the last blog post, we walked through setting up some of the initial infrastructure (VMs and the database) that we'd need to rely on when building our API and interacting with it. In this post, we'll go over how to build the API.

#### Create the API using Flask
Again, this is not a tutorial on all things, so I won't be diving into the granular details of Flask, but I'll be explaining the key things as we go. To get started, we need to install Flask on to our server VM (this is the one with 1 CPU and 2GB of RAM). To do this, we'll first need to install pip, so run the following commands on the VM that will be your server.

```
sudo app install python3-pip
pip3 install flask
```

To make sure this works, enter Python from the terminal and run `from flask import Flask`. If that works, you're good to go. So let's dive into the code. Create a file called "app.py". That's going to hold all of the code we need for our API. We'll start by just enumerating the modules we're importing.

```python
from flask import Flask, jsonify, request, Response
import sqlite3
import os
import json
```

This should be relatively straight-forward. The next thing we're going to do is initialize a couple of variables upfront.

```python
basedir = os.path.abspath(os.path.dirname(__file__))
app = Flask(__name__)
```

The first line isn't really necessary, but it allows us to ensure that our base directory is always the directy in which app.py lives, which is useful for connecting to the database, and allows us to call app.py from anywhere. The second line initializes our Flask app using the `__name__` variable, which in our situation will just be equal to "__main__". You can read more about Flask [here](https://flask.palletsprojects.com/en/1.1x/api/). We'll finish with the skeleton of the file (the base code needed to run the Flask app) by telling the script to run the app if app.py is called directly.

```python
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
```

Setting debug equal to True allows us to keep the app running while we change things in app.py without having to stop the app and restart it. Setting host equal to "0.0.0.0" allows the app to listen for connections from more than just the localhost, which is crucial for being able to connect to the API from our client VM. 

Now that we have our skeleton, let's add some functionality so we can check that it's actually working. Add the following code just above the `if __name__ ==` line.

```python
@app.route("/api/v1/stream/flows.json", methods=["GET"])
def test():
    return Response(
        json.dumps({"msg": "Hello World!"}), 
        mimetype="application/json"
    )
```

Save the file and exit and then run `python3 app.py`. You should see something like the following:

```bash
* Serving Flask app "app" (lazy loading)
* Environment: production
  Warning: This is a development server. Do not use it in a production deployment.
  Use a production WSGI server instead.
* Debug mode: on
* Running on http://0.0.0.0:5000/ (Press CTRL+C to quit)
* Restarting with stat
* Debugger is active!
* Debugger PIN: ###-###-###
```

If you see that, head over to your client VM and open a browser (or just use the browser on your host) and go to `http://<private IP of your server>:5000/api/v1/stream/flows.json`, where the private IP address of your server should be something like 192.168.1.*. You should be greeted with JSON data that says "Hello world". But that's not a very useful API, so we'll add the real functionality now. 

The code we just added is what's called a route, and it tells Flask two things:

1. What end points should users be able to hit, and  
2. What Flask should do when users hit a specific end point.

So as you may have deduced from the code and the URL that you navigated to, "/api/v1/stream/flows.json" is the initial endpoint that we're creating for this API. The second parameter that was passed to `@app.route` is the methods that the end point should accept, with GET and POST being the two most common. The rest of the code that we added is what the endpoint should do when a user hits that endpoint with the method we specified. In our quick example, it returned a simple JSON-like string (that's what `json.dumps` does) to the client. We're going to change this code to now connect to our database, run a query, and stream the results back to the client. 

In your file, replace this:

```python
def test():
    return Response(
        json.dumps({"msg": "Hello World!"}), 
        mimetype="application/json"
    )
```

with this:

```python
def query_flows():
  conn = sqlite3.connect(basedir + "/flows.db")
  c = conn.cursor()
  q = "SELECT * FROM flows LIMIT 10"
  c.execute(q)
  return Response(stream(conn, c), mimetype="application/json")
```

The first line of our new code is us connecting to our sqlite database. This is a persistent connection and will stay open until we close it, which you should be mindful of because too many open connections on a database is problematic. The second line creates a cursor inside of our database, which acts as a pointer. The third line is our query. We're going to grab all of the variables, but only the first 10 records for now. Best to test small before going big. The fourth line "executes" the query. I put execute in quotes because while it does execute the query, it doesn't actually return any of the data, which is advantageous for us. The last line returns the output of a currently undefined function called stream as a `Response` object. To really take advantage of this, we need to create a generator that will yield each record from our database to `Response` so it can send it to the client and get ready for the next record. To do this, we'll create a new function called stream. Put the following code above your `@app.route` line.

```python
def stream(conn, records):
  try:
    prev_record = next(records)
  except StopIteration:
    yield '{}'
    raise StopIteration
  
  for record in records:
    yield json.dumps(format_record(prev_record)) + "\n"
    prev_record = record
  
  conn.close()
  yield json.dumps(format_record(prev_record))
```

What we've built here is a lagged generator. Because we're appending a delimiter to each JSON record - here we're using a new line character - we need to make sure we don't append it to the last record that gets returned. Otherwise, we'd be sending malformed JSON to the user. To overcome this, we'll jump start the iteration by calling `next` on the iterator to get the first result before we even start our loop. What this means is that once we begin our loop via `for record in records`, the first value that `record` gets is actually the second value in `records`, not the first. That value is stored in `prev_record`. So we jump in at the second record, yield the first record, and then set `prev_record` to the current record. Assume there are five records in the table that we query. If you follow this through, you'll see that once we get to the fifth and final record, we'll be returning the fourth record with our delimiter attached, which means we still need to return our fifth record. We do that with our final `yield` call in the function, just after we close our connection to the database. If you're not familiar with the `yield` keyword, I would highly encourage looking it up, as it has some very powerful properties.

But let's look at this function with a little more detail and walk through it line by line. The first thing we notice is that the function takes two parameters: conn and records. If we look at the line in our code where we call `stream`, we'll see that we're passing in `conn`, which is our database connection, as the first parameter, and `c`, which is our cursor that is holding the query we executed, as the second parameter. I named it records in the stream function because that's what it represents. `c` is an iterable that on each call will return the next record from the result set that is generated by the query. Once all results have been returned, `c` has been exhausted. So looping over `c` is really looping over the records. The next thing we do is utilize a try/except structure to capture any events in which our query returns no results. In this case, we'll return an empty JSON-like string. Assuming there are results, we loop over them returning the data as I described above until we've exhausted the results. Once all but the last record has been returned to the client, we close the database connection and then return that final record.

With this functionality in place, we're left with just one more function to define, which is the `format_record` function that we utilize in `stream`. This function does nothing other than convert the record that is returned from a tuple to a dict so that it can be passed as JSON to the client. It's defined below and should be self explantory.

```python
def format_record(record):
  return {
    "id": record[0],
    "time": record[1],
    "duration": record[2],
    "src_comp": record[3],
    "src_port": record[4],
    "dst_comp": record[5],
    "dst_port": record[6],
    "protocol": record[7],
    "packet_count": record[8],
    "byte_count": record[9]
  }
```

And now, with that, you should be able to refresh the page in your browser that's calling the API and see the first 10 records of the flows table returned to you as JSON. Congratulations! You just built an API. Well, sort of. At this point we've really just served a JSON file from an endpoint, whereas an actual API would allow you to pass parameters to the endpoint that customizes what data you get back. In the example of what my friend needs, we need the ability to specify a "scanned_after" parameter to avoid grabbing data that we've already grabbed. The default behavior of the API should be that if this parameter is not passed, it returns all data. Lastly, we'll also introduce a "scanned_before" parameter. This will be useful for defining a rolling window for which we want to return data. 

Implementing this is thankfully relatively easy thanks to the `request` attribute from Flask. `request` has a property called "args", which will hold the parameters we pass to the URL in a dictionary that we can access. To see how this works, let's create a temporary endpoint that will just return our parameters back to us. Add the following snippet of code just above your `if __name__` line. 

```python
@app.route("/api/v1/test", methods=["GET"])
def get_parameters():
  return jsonify(request.args)
```

Now, if you navigate to that endpoint in your browser via `http://<private IP of your server>:5000/api/v1/test?x=1&y=2` you should be presented with JSON data showing `{"x": 1, "y": 2}`. Hopefully this demonstrates to you how we can access these parameters and use them in our API call. Feel free to play around with some examples of this, and once you feel you understand what it's doing, delete that entire snippet of code from your app.py file.

Because the API parameters are automatically collected in a dictionary, we can check that dictionary for the presence of "scanned_after" or "scanned_before" and embed those into our query to avoid returning all of the results. We can also add a "limit" parameter to further restrict how many results are returned. To do this, we're going to add a few of lines of code to our `query_flows` function. We'll add three lines to try to grab the parameters we're interested in, and then we'll change our query to implement these parameters. Replace your `query_flows` function with the following code:

```python
def query_flows():
  conn = sqlite3.connect(basedir + "/flows.db")
  c = conn.cursor()
  start = request.args.get("scanned_after", 0)
  end = request.args.get("scanned_before", 5011300)
  args = (start, end)
  q = "SELECT * FROM flows WHERE time > ? AND time <= ?"
  
  limit = request.args.get("limit", None)
  if limit is not None:
    q += " LIMIT ?"
    args = (start, end, limit)
  
  c.execute(q, args)
  return Response(stream(conn, c), mimetype="application/json")
```

The three lines that we added utilize `request.args.get`, which grabs the `args` property from `request`, which we just saw was a dictionary, which has a method called `get` that allows us to try to access a key, but if that key doesn't exist it will return a default value. For `start`, we've set the default value to 0 since if it's not present we don't want to exclude any records, and similarly for `end` we set the default to a value that is larger than any value in the data. There are multiple ways to handle this, but this was the simplest approach for the data we're working with. 

We also modified our query to include `WHERE time > ? AND time <= ?`, which time bounds the data that is returned to the user. The `?` is `sqlite3`'s way of using placeholders to pass in variables to your query in a safe way. This allows the sanitization of the inputs to be handled by the module instead of by us, which is very nice. In order to pass in our variables, we pass them as a tuple to `c.execute()` in the order in which we want them placed into the query. Notice that we've also removed the hardcoded `LIMIT` on our query and replaced it with a parameterized, dynamically added version that's more applicable for production.

With this functionality in place, you should be able to navigate to `http://<private IP of your server>:5000/api/v1/stream/flows.json?scanned_after=86400&scanned_before=86401` to get a single second of activity from the data. Note that `time` in our data is the number of seconds from some point in time that was determined by LANL. We don't actually have dates, and only know that the data covers 58 days of activity. Thus, the parameters we just passed would represent the first second of activity on the second day.

*IMPORTANT NOTE:* You will most likely get a SyntaxError when you run this request. This is because we're technically returning invalid JSON to the user because it's not contained in a single container, either `[...]` or `{results: [...]}`. But if you click the "Raw Data" tab at the top of the window (at least on Firefox that's how you do it, not sure how to do it on Chrome) you'll see that the data is in fact being returned. In a real app, we'd ensure that we handled that.

The last thing we're going to do is make it so that our API can return both JSON and XML. We started with JSON because it's easier to work with, aligns with the tutorials you can find online, and is objectively the better data format. But since this was all inspired by the need to ingest XML, we'll want that format for the next part of this blog series. To do this, we'll add another line to `query_flows` to check the API call for a `format` parameter, which we'll default to JSON, and then we'll modify `format_records` to return JSON or XML on demand.

Change the endpoint to no longer specify the format:

```python
@app.route("/api/v1/stream/flows", methods=["GET"])
```

Add the following lines to `query_flows`:

```python
fmt = request.args.get("format", "json")
content_type = f"application/{fmt}"
```

Change the return statement in `query_flows` to be:

```python
return Response(stream(conn, c, fmt), mimetype=content_type)
```

define `stream` as follows:

```python
def stream(conn, records, fmt):
  try:
    prev_record = next(records)
  except StopIteration:
    if fmt == "json":
      yield "{}"
    else:
      yield "<?xml verion='1.0' encoding='UTF-8'?><records/>"
    raise StopIteration
    
  if fmt == "xml":
    yield "<?xml version='1.0' encoding='UTF-8'?><records>"
  for record in records:
    yield format_record(prev_record, fmt) + "\n"
    prev_record = record
  
  conn.close()
  yield format_record(prev_record, fmt)
  if fmt == "xml":
    yield "</records>"
```

Pass the format to the `format_record` function (make sure to change this line in both locations):

```python
yield json.dumps(format_record(prev_record, fmt))
```

And lastly, define `format_record` as follows:

```python
def format_record(record, fmt):
  if fmt == "json":
    return {
      "id": record[0],
      "time": record[1],
      "duration": record[2],
      "src_comp": record[3],
      "src_port": record[4],
      "dst_comp": record[5],
      "dst_port": record[6],
      "protocol": record[7],
      "packet_count": record[8],
      "byte_count": record[9],
    }
  else:
    s = """
    <record>
      <id>%d</id>
      <time>%d</time>
      <duration>%d</duration>
      <src_comp>%s</src_comp>
      <src_port>%s</src_port>
      <dst_comp>%s</dst_comp>
      <dst_port>%s</dst_port>
      <protocol>%d</protocol>
      <packet_count>%d</packet_count>
      <byte_count>%d</byte_count>
    </record>
    """ % record
    return s.strip().replace("\n", "").replace(" ", "")
```

If you've set this up correctly - the full code is pasted below for you to compare to - you can now naivate to `http://<private IP of your server>:5000/api/v1/stream/flows?scanned_after=86400&scanned_before=86401&format=xml` and see XML results returned back to you. And if that's the case, then now you can celebrate because you've officially created an API! Be sure to check out the next part of the series where we pull data from this API, process it, and send it to GBQ.

#### Full Code

```python
from flask import Flask, request, Response
import sqlite3
import os
import json

basedir = os.path.abspath(os.path.dirname(__file__))
app = Flask(__name__)

def format_record(record, fmt):
  if fmt == "json":
    return {
      "id": record[0],
      "time": record[1],
      "duration": record[2],
      "src_comp": record[3],
      "src_port": record[4],
      "dst_comp": record[5],
      "dst_port": record[6],
      "protocol": record[7],
      "packet_count": record[8],
      "byte_count": record[9],
    }
  else:
    s = """
    <record>
      <id>%d</id>
      <time>%d</time>
      <duration>%d</duration>
      <src_comp>%s</src_comp>
      <src_port>%s</src_port>
      <dst_comp>%s</dst_comp>
      <dst_port>%s</dst_port>
      <protocol>%d</protocol>
      <packet_count>%d</packet_count>
      <byte_count>%d</byte_count>
    </record>
    """ % record
    return s.strip().replace("\n", "").replace(" ", "")
    
def stream(conn, records, fmt):
  try:
    prev_record = next(records)
  except StopIteration:
    if fmt == "json":
      yield "{}"
    else:
      yield "<?xml verion='1.0' encoding='UTF-8'?><records/>"
    raise StopIteration
    
  if fmt == "xml":
    yield "<?xml version='1.0' encoding='UTF-8'?><records>"
  for record in records:
    yield format_record(prev_record, fmt) + "\n"
    prev_record = record
  
  conn.close()
  yield format_record(prev_record, fmt)
  if fmt == "xml":
    yield "</records>"

@app.route("/api/v1/stream/flows", methods=["GET"])
def query_flows():
  conn = sqlite3.connect(basedir + "/flows.db")
  c = conn.cursor()
  start = request.args.get("scaned_after", 0)
  end = request.args.get("scanned_before", 5011300)
  args = (start, end)
  q = "SELECT * FROM flows WHERE time > ? AND time <= ?"
  
  limit = request.args.get("limit", None)
  if limit is not None:
    q += " LIMIT ?"
    args = (start, end, limit)
  
  c.execute(q, args)
  fmt = request.args.get("format", "json")
  content_type = f"application/{fmt}"
  c.execute(q, (start, end))
  return Response(stream(conn, c, fmt), mimetype=content_type)
  
if __name__ == "__main__":
  app.run(debug=True, host="0.0.0.0")
```
