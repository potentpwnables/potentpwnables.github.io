---
title: Piping API Data To Google Big Query Using Python - Part I
author: ''
date: '2020-06-29'
slug: piping-api-to-gbq-python-part-i
categories: []
tags:
  - api
  - bigquery
type: ''
subtitle: ''
image: ''
readtime: true
---

This is the first installment of a three-part blog post:
* [Setting up the Infrastructure](https://tibblesnbits.com/2020/piping-api-to-gbq-python-part-i)  
* [Building the API](https://tibblesnbits.com/2020/piping-api-to-gbq-python-part-ii)
* [Piping it to Google BigQuery](https://tibblesnbits.com/2020/piping-api-to-gbq-python-part-iii)

Welcome to the inaugural post for my blog! Well... sort of inaugural. I've created and destroyed this blog a hundred times, but that's neither here nor there. What has brought me back from the ashes to write is a task that a good friend of mine asked me to help with. It was something that had a lot of elements to it, and it nerd sniped me pretty good. Basically, the task was to perform an initial dump from the Qualys API so that he had all of the historical data, and then set up a cron job that would grab any new data every three hours. That data was then to be fed into Google BigQuery (GBQ) so that dashboards could be made, so it had to relatively fast and reliable. The problem was that the historical data was approximately 50GB worth of XML, so it couldn't all be held in memory and processed. This got me thinking about various solutions, and I think I've got something that will work quite nicely. 

Before we begin, it's worth pointing out that this post will not be a thorough tutorial on every step. The onus of things like setting up VMs, working with certain files, and setting up a GBQ account will be put on you.

So let's lay out what we would need to do if we were my friend:

1. Connect to the API and start pulling the data with Python  
2. Process the data inside of Python as it streamed  
3. Push that data to Google's BigQuery  
4. Repeat steps 1-3 for any new data that comes in after our initial pull

But here's the rub: I don't have access to the API that he's using, so that complicates my ability to create a solution tailored specifically to his need. But it also creates an opportunity to learn a little bit more about APIs than I knew before by building one from scratch. And that also means we'll need some data of our own. Once we have that, we can build our client-side processer and push the results to BigQuery. So here's what our steps will look like:

1. Set up two VMs to mimic having a client and server  
2. Download the flows.txt.gz file from [LANL](https://csr.lanl.gov/data/cyber1/)  
3. Clean the data  
4. Import the data into a sqlite database  
5. Create the API using Flask  
6. Grab a subset of the data  
7. Process it  
8. Send it to GBQ  
9. Set up a script to iteratively grab newer chunks of the data  
10. Profit

#### Set up our VMs
First and foremost, I want to say that I'm using two VMs because I didn't want to clutter my host with the stuff we'd be creating on the client machine. It's worth pointing out that you could absolutely create a single VM to serve as the server, and connect to the API from your host. Additionally, I'm not going to go into any level of detail here as there are TONS of blogs, videos, etc on how to set up a virtual machine.

But what I will say is that both machines are running Ubuntu 20.04 via VirtualBox using a Bridged network adapter. I'm not an expert, so it might be possible to achieve this using a NAT network adapter, but in order to get the two machines to be able to talk to each other I had to use Bridged. In order to ensure that your client VM can talk to the server VM, you should run `ip addr show` on both machines, and then have each machine ping the other, just to make sure they can see each other. 

For specs, I've set it up so that the VM acting as the server, which will house the sqlite database and the API, is using a single CPU and 2 GB of RAM. The VM that I'm using to actually pull the data from the API is using 2 CPU and 4 GB of RAM. Each machine has a cap of 100GB of storage. The purpose for doing this was to show that this method of handling the data as it streams in allows us to work with very large data using minimal hardware.

#### Download and clean the data
Getting the data is a bit of a hassle because LANL changed their website to now ask you for your email and what you're going to use the data for. You don't have to provide real answers, but I haven't seen them send any spam email to me, and seeing that people are using the data they provide likely incentives them to continue to provide data. So I'd encourage you to at least provide a real reason (e.g. "Creating an API from scratch and using this as the database"). Anyway, once you do that, you can just click the file and the download will start. I opted for the flows.txt.gz file because it was pretty small and we don't need a lot of data. The original ask involved about 50GB of data, that included all of the overhead of XML, and as we'll see later on, that small file ends up being a lot of data once we add in that overhead.

Once we have the data, we'll need to decompress it and then do a couple of preprocessing things. Running `gunzip flows.txt.gz` will give us the files that we need, so now we can begin preprocessing the data. The first thing we want to do is ensure that every row has only the data that we want. What this means is that if a data ingestion tool were to try to import this file, which is a CSV, using commas as delimiters, would it find the exact number of columns that it expected on each row? We can ensure that it does by checking the number of columns ourself first. Since this is just test data, we don't have to worry about what to do if some of the records are incorrect, but in the real world that's definitely something you'd want to consider. For us, we can run the following command:

```
cat flows.txt | awk -F , 'NF == 9{print}{}' >> flows.csv
```

What this is doing is piping the file into awk and telling awk to use the comma as a delimeter (`-F ,`) and then check if there are 9 fields (`NF == 9`) on that line. If there are, then print the line (`{print}`), otherwise do nothing (`{}`). The output is then piped into flows.csv. The end result is a CSV file that is guaranteed to have the exact number of fields expected on each line, which will prevent any ingest errors when we load it into sqlite.

The next step is add the row number to each line. The reason for this is that the flows data does not have a single column that is unique to every row, and Flask will complain if you try to feed it a table that doesn't have a primary key defined in the table. This is kind of annoying because sqlite would have given us a primary key for free via `ROWID`, but Flask forces us to set our own. To do this, we'll again use awk.

```
mv flows.csv flows.txt
cat flows.txt | awk '{printf "%s,%s\n", NR, $0}' >> flows.csv
```

Again, we're piping the file into awk - and yes, I know you can just feed the file in; get off my back - and then using `printf` to format the line before printing. The `"%s,%s\n"` is the format of the line, which accepts two variables, designated by the `%s`, separated by a comma and followed by a new line. `NR` is the row number, and is our first variable, and `$0` is the line of data, and is our second variable. Once this is finished running, if you run `head -n 3 flows.csv`, you should see something that looks like this:

```
1,1,0,C1065,389,C3799,N104561,6,10,5323
2,1,0,C1423,N1136,C1707,N1,6,5,847
3,1,0,C1423,N1142,C1707,N1,6,5,847
```

#### Import the data into sqlite
Assuming that went well, we're ready to import the data into sqlite. To do this, we'll first need to install sqlite3 on our machine by running `sudo apt install sqlite3`. Once that's installed, run `sqlite3 flows.db` and that'll drop you into sqlite inside of the newly created flows.db file (it creates the file in the current working directory if it doesn't already exist). Your terminal should look something like this:

```sql
SQLite Version 3.31.1 2020-01-27 19:55:54
Enter ".help" for usage hints.
sqlite> 
```

Our next step is to create the table that we're going to store our data in. If you've worked with SQL before, this is probably pretty familiar to you, but if you haven't, I'd recommend taking some time to read a couple blog posts about it. But even if you haven't, all of the following will hopefully still be pretty readable for you. At the prompt, type the following snippet of code.

```sql
CREATE TABLE flows(
    id INTEGER PRIMARY KEY, 
    time INTEGER NOT NULL, 
    duration INTEGER NOT NULL, 
    src_comp TEXT NOT NULL, 
    src_port TEXT NOT NULL, 
    dst_comp TEXT NOT NULL, 
    dst_port TEXT NOT NULL, 
    protocol INTEGER NOT NULL, 
    packet_count INTEGER NOT NULL, 
    byte_count NOT NULL)
    WITHOUT ROWID;
```

If you don't get any errors, you should be able to run `.tables` and have it return "flows" to you. You should also be able to run `.schema` and have it return back what you just typed in. If that all works, we can now import our CSV that we created. One thing you may have noticed is that our CSV doesn't have a header row on it, saying what the columns are. This is by design since sqlite already knows what the columns are. It expects that the data being read in is in the order in which you specified the columns in your `CREATE TABLE` statment. So to do this, we'll run two commands. The first tells sqlite that we're about to deal with some CSV data, and the second imports the data.

```
.mode csv
.import /absolute/path/to/flows.csv flows
```

The first argument to `.import` is the path to the file you want to import, and the second argument is the name of the table you want to store it in. This is going to take a minute to run, so feel free to grab some coffee or something. The good news is that we've finalized setting up the infrastructure and we can now begin the fun part of actually building the API. Check out the [next installment](https://tibblesnbits.com/2020/piping-api-to-gbq-python-part-ii) of this series to see how we do it.
