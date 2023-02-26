---
title: Solving CyberDefenders' Insider Challenge
author: ''
date: '2023-02-26'
slug: cyber-defenders-insider-challenge
categories: []
tags:
  - ctf
  - cyberdefenders
  - linux
type: ''
subtitle: ''
image: ''
readtime: true
---

This is another post in a series of CTF challenges I've been doing through [CyberDefenders](https://cyberdefenders.org). This one looks at their [Insider challenge](cyberdefenders.org/blueteam-ctf-challenges/64), which focuses on the analysis of a Kali Linux box.

###### Instructions
* Unzip the challenge (pass:cyberdefenders.org)  
* Load the AD1 image in FTK Imager latest Windows version


###### Scenario
After Karen started working for 'TAAUSAI', she began to do some illegal activities inside the company. 'TAAUSAI' hired you to kick off an investigation on this case. You acquired a disk image and found that Karen uses Linux OS on her machine. Analyze the disk image of Karen's computer and answer the provided questions.


###### Questions
1. What distribution of Linux is being used on this machine?  
2. What is the MD5 hash of the Apache `access.log`?  
3. It is believed that a credential dumping tool was downloaded. what is the file name of the download?  
4. There was a super-secret file created. What is the absolute path?  
5. What program used `didyouthinkwedmakeiteasy.jpg` during execution?  
6. What is the third goal of the checklist that Karen created?  
7. How many times did Apache run?  
8. It is believed this machine was used to attack another machine. What file proves this?  
9. Within the Documents file path, it is believed that Karen was taunting a fellow computer expert through a bash script. Who was Karen taunting?  
10. A user su'd to root at 11:26 multiple times. Who was it?  
11. Based on the bash history, what is the current working directory?  


###### Question 1
When loading the AD1 image into FTK Imager, you're presented with a file directory that should be fairly obvious is not Windows. The first thing I noticed was that it didn't have the patented structure I'm familiar with in Windows, including `Program Files`, `Users`, and `Windows`. Instead, you're given three folders: `boot`, `root`, and `var`. Clicking on the first of these folders, `boot`, without even digging down into the folder, gives us the answer to the first question. When you click on this folder, you see files that all mention, Kali, which is a well known distribution of Linux, and the answer to our first question.

<figure>
<img src="/assets/posts/0001-01-10-cyber-defenders-insider-challenge/question1.png" alt="Image of the files located in the boot directory" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">The files located inside of the boot directory as seen in FTK Imager</span>
</figcaption>
</figure>


###### Question 2
In order to get the answer to this question, I opted to export the file, which is located at `/var/logs/apache2/access.log`, by right-clicking and selecting "Export Files...". Once I had that, I could use PowerShell to run `Get-FileHash -Algorithm md5 access.log`. This gives us the answer that we need, which is `d41d8cd98f00b204e9800998ecf8427e`.

<figure>
<img src="/assets/posts/0001-01-10-cyber-defenders-insider-challenge/question2.png" alt="Image of the md5 hash being calculated for access.log" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">The Md5 hash for the Apache access.log file</span>
</figcaption>
</figure>


###### Question 3
This question sort of gave away the answer in the question itself. First and foremost, it says "a credential dumping tool was downloaded", which immediately made me check the `Downloads` folder. There was one file in there, which was a zip file, and the question's answer text input had a placeholder that gave a hint for the format of the answer, which ended in ".zip". So even if you weren't familiar with [Mimikatz](https://github.com/ParrotSec/mimikatz), you'd still have a pretty good idea of what the answer is, which is `mimikatz_trunk.zip`.

<figure>
<img src="/assets/posts/0001-01-10-cyber-defenders-insider-challenge/question3.png" alt="Image of a ZIP file named mimikatz in the Downloads folder" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Evidence of Mimikatz being downloaded</span>
</figcaption>
</figure>


###### Question 4
I really liked this question because it didn't really give too much information, and expected you to explore through the data available to you. The thing I liked about this is that because there wasn't much to go, I found myself exploring a lot of files that I thought would be useful, including the files in the `Documents` and `Pictures` folders. But it also caused me to look in the `~/.bash_history` file, which proved to be quite useful. In fact, that file was used to answer this question, the next one, and the last one. the absolute path for this created file is `/root/Desktop/SuperSecretFile.txt`.

<figure>
<img src="/assets/posts/0001-01-10-cyber-defenders-insider-challenge/question4.png" alt="Image of the command history showing a command that was run that created a file called SuperSecretFile.txt" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">The commands that created SuperSecretFile.txt</span>
</figcaption>
</figure>


###### Question 5
If you scroll a little further down in that same file, you'll see the `binwalk` command being used on the JPG file mentioned in the question.

<figure>
<img src="/assets/posts/0001-01-10-cyber-defenders-insider-challenge/question5.png" alt="Image of the command history showing a command that was run on didyouthinkwedmakeiteasy.jpg" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Evidence of binwalk being used on didyouthinkwedmakeiteasy.jpg</span>
</figcaption>
</figure>


###### Question 6
This was another great question because it didn't really tell you much. Just that Karen had a checklist, and you need to find evidence of it existing. If you navigate around enough, you're sure to look in the Desktop folder, which holds the `Checklist` file. Viewing this in FTK Imager shows that the third goal is "Profit".

<figure>
<img src="/assets/posts/0001-01-10-cyber-defenders-insider-challenge/question6.png" alt="Image of Karen's Checklist file as viewed in FTK Imager" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Karen's checklist as viewed in FTK Imager</span>
</figcaption>
</figure>


###### Question 7
This question is the one that threw me through the biggest loop, but was an incredibly good lesson to be reminded of, which is that the abscence of data is still data. What that means in this context is that when I went to `/var/logs/apache2/error.log`, where [this answer](https://askubuntu.com/questions/14763/where-are-the-apache-and-php-log-files) on StackExchange said the data should be, I found the file to be empty. My first reaction to this was "Great, another busted CTF with bad data". But that was an erroneous assumption. In fact, the lack of any logs in the file was itself an indicator that Apache had not been run on the machine. The answer, then, to the question of how many times Apache had been run is 0. Now, this of course ignores anti-forensics measures that should be considered like a bad actor deleting data from the file, but for the purposes of this CTF this question was really great for reminding me that missing data is still data.

<figure>
<img src="/assets/posts/0001-01-10-cyber-defenders-insider-challenge/question6.png" alt="Image of the empty Apache error.log file as viewed in FTK Imager" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Apache error.log file as viewed in FTK Imager</span>
</figcaption>
</figure>


###### Question 8
Again, this question was mostly just a matter of exploring the most common directories and taking note of the interesting files. If you navigated to the `/root` directory, you'd find a JPG file sitting in there. You can't open this in FTK Imager, but if you export the file, you can open it locally and see Karen had taken a screenshot of themself running some malicious commands. The file was named `irZLAohL.jpg`.

<figure>
<img src="/assets/posts/0001-01-10-cyber-defenders-insider-challenge/question6.png" alt="Image of a command console running malicious commands" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">The contents of the irZLAohL.jpg file</span>
</figcaption>
</figure>


###### Question 9
This question felt a like a bit of a stretch for a digital forensics CTF, but I did appreciate the point I think it was highlighting, which is that people will often gossip about others, or otherwise write down opinions, facts, or other commentary about people in documents, emails, code comments, etc, and that information can be invaluable in helping to demonstrate motive in a case. I'm not sure the extent to which that is true, but it's the takeaway I chose to walk away with from this question. The answer can be found by looking in the `/root/Documents/myfirsthack/firstscript_fixed` file, and looking at the last line of the file to see they were taunting Young. 

<figure>
<img src="/assets/posts/0001-01-10-cyber-defenders-insider-challenge/question9.png" alt="Image of the firstscript_fixed file as viewed in FTK Imager showing Karen taunting someone named Young" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Evidence of Karen taunting Young</span>
</figcaption>
</figure>


###### Question 10
This was the hardest question for me because I didn't know exactly where to look, and the answer wasn't just immediately presented to you like it was in the other questions. When I tried to Google "how to monitor who is using `su`", I was met with a lot of answers that recommended looking in `/var/log/sulog`. But that file doesn't exist on this machine. So instead of trying to Google to have the Internet just point me to the answer, I decided to dig into the files in the `/var/logs` directory and see which ones might make sense. Given that this disk images has, ostensibly, been pared down quite a bit, it was easy to find the `auth.log` file, which felt like a good place to look. The second reason that this question was harder than the others was that the question simply stated that this event took place at 11:26. It didn't specify AM or PM, nor did it specify the date. So I had to look through the logs for every day at both 11:26 and 23:26 just to make sure I didn't miss it. Again, thankfully the files are small and it was pretty straightforward to find the answer, which is `postgres`.

<figure>
<img src="/assets/posts/0001-01-10-cyber-defenders-insider-challenge/question10.png" alt="Image of auth.log showing that the postgres user elevated to super user at 11:26 on March 20th" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Evidence that the postgres user elevated to super user</span>
</figcaption>
</figure>


###### Question 11
The final question really just tests your understanding of the `cd` command and how `./` and `../` work. Some simple path navigation shows that the current working directory, according to the `~/.bash_history` file is `/root/Documents/myfirsthack/`. 

<figure>
<img src="/assets/posts/0001-01-10-cyber-defenders-insider-challenge/question11.png" alt="Image of the cd commands in the bash history showing how the user navigated through the directories" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Snippet of the ~/.bash_history file as viewed in FTK Imager</span>
</figcaption>
</figure>
