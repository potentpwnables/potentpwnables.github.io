---
title: Testing Hypotheses to Avoid Rabbit Holes in Investigations
author: ''
date: '2022-11-21'
slug: testing-hypotheses
categories: []
tags:
  - investigations
  - tips-n-tricks
type: ''
subtitle: ''
image: ''
readtime: true
---

Back in 2016 I was working for the Manhattan District Attorney’s Office,
and my job was to investigate money laundering and terrorist financing.
Because the US Dollar (USD) serves as the dominant reserve currency and
is used to conduct international trade and financial transactions, and
because all USD transactions must go through a US bank, and because the
largest US banks are all headquartered in Manhattan, our office had
jurisdiction on these types of cases. Our leads would come from several
sources, but it likely serves as no surprise that one such source was
the news. So, one day, I’m sitting at my desk reading the Wall Street
Journal, and I come across [an
article](https://www.wsj.com/articles/how-islamic-states-secret-banking-network-prospers-1456332138)
that was talking about how ISIS was moving its money. Within the
article, they mentioned a specific shipping company that was being used
by ISIS to transfer funds and utilize its logistic network to ship
goods. Going through the usual process of issuing subpoenas to all of
the major banks for any accounts associated with the shipping company, I
got lucky and had a few hits. As I was perusing the financial records, I
noticed something strange: there were several transactions in which this
shipping company was *sending* money to what appeared to be people
unaffiliated with the business, who all lived within 3 miles of each
other. In investigations like this, there is always a trade off to
including a new asset or not. For any given business or individual that
is added to a case, the investigator must issue subpoenas to the major
banks, phone providers, and email providers in order to get any relevant
information. This means writing subpoenas, getting them signed, sending
them out, waiting for the documents to come back, and then reading
through all of that data and linking it to other data you have. This is
an incredibly time consuming process, and there lies the rub. Should I
add these assets to the investigation? Was the fact that they lived so
close to each other actually as suspicious as I felt it was?

## The Hypothesis

When conducting investigations, you’re bound to have several hypotheses
that develop along the way, and it’s useful to have a framework by which
to test those hypotheses. In this post, I’m going to recreate the
analysis I used to determine if we should issue subpoenas for the
aforementioned individuals to show how a little bit of computer
programming can help save hours of data analysis. So, let’s phrase the
above hypothesis - individuals receiving money from a company of
interest living that close together is suspicious - into a question that
can be answered with an experiment.

**What is the probability that three individuals chosen at random from
this city would live within 3 miles of each other?**

## The Approach

In order to test this analysis, we’re going to use a [Monte Carlo
Simulation](https://en.wikipedia.org/wiki/Monte_Carlo_method) to
randomly choose three “addresses” in a city and then measure how far
apart those addresses are from each other. We’ll repeat this process one
thousand times, keeping track of the average distance ((d<sub>12</sub> +
d<sub>13</sub> + d<sub>23</sub>) / 3, where d<sub>12</sub> is the
distance between person 1 and person 2) each time, and then we’ll plot a
histogram of those distances to get a sense of the distribution of
addresses. In order to choose which “address” to choose, or in other
words where to place a point on our map, we’ll use the population
density of census tracts as our weight. This will help ensure that we
account for the fact that people are not typically uniformly distributed
throughout a city, but instead tend to cluster towards downtown and city
center areas. We’re also going to use the algorithm described in [this
StackOverflow
question](https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula).
It’s likely not the correct distance metric to use, but I mean, it’s not
like we’re submitting this analysis into court; we’re just trying to
decide if we want to investigate these people at all.

So, in summary, our approach is to randomly place three dots inside of a
city map using the population density as a means to choose where to
place those points. We’ll do this one thousand times and calculate the
Euclidean distance between all three points each time, and then create a
graph at the end that shows the distribution of distances.

## The Data

In order to test this hypothesis, we’ll need to do the following:

1.  Choose a city where we want our hypothetical people to live.  
2.  Download the census tracts for that city.  
3.  Download the population demographics for those census tracts.  
4.  Randomly place 3 points inside of our shapefile using the population
    density.  
5.  Repeat step 4 one thousand times.

For this experiment, I’m going to use Detroit as the city. While I’m
sure most people would assume this, I think it’s worth explicitly
stating that this is *not* the city in which these individuals from the
case lived. It is, however, a city near and dear to my heart, so we’ll
work with that. I’m going to use R for this analysis, and will be
relying on the `dplyr`, `tigris`, `tidycensus`, `ggplot2`, and `sf`
packages to conduct my geospatial analysis. We can get the census tract
shapefiles from the `tigris` package, but we’ll also need the shape file
for Detroit’s city boundary. We’re grabbing the city boundary because
`tigris` grabs county-level data, and a county obviously contains more
than one city. So, with that being said, let’s dive into grabbing the
data. Let’s start by grabbing the Detroit city boundary shape file,
which can be downloaded from
[here](https://data.detroitmi.gov/datasets/detroitmi::city-of-detroit-boundary/explore?location=42.352615%2C-83.099114%2C11.97).

Once that’s downloaded, let’s load that into R, and also grab the Wayne
County census tracts. We can then plot the city boundary for the city of
Detroit to confirm that we’ve loaded it.

    library(dplyr)
    library(tigris)
    library(tidycensus)
    library(sf)
    library(ggplot2)

    detroit <- st_read("detroit_boundaries/City_of_Detroit_Boundary.shp", quiet=T)

    # to get the values for state and county run lookup_codes("Michigan", "Wayne")
    wayne_county <- tracts(state=26, county=163, year=2021)

    ggplot() +
        geom_sf(data=detroit) +
        theme(
            panel.grid.major=element_blank(), 
            panel.grid.minor=element_blank(),
            panel.background=element_blank(),
            axis.text.x=element_blank(),
            axis.ticks.x=element_blank(),
            axis.text.y=element_blank(),
            axis.ticks.y=element_blank()
        ) + 
        labs(x="City of Detroit")

![](/assets/posts/0001-01-05-testing-hypotheses_files/figure-markdown_strict/library_load-1.png)

Excellent! We’ve got the city of Detroit mapped out, but now we need to
add in the census tracts. We already have the census tract data
downloaded thanks to the `detroit_census_tracts <- tracts(...)` code we
ran above. The problem, however, as mentioned before, is that the census
tract data is for all of Wayne County, so we need to prune that data.
This can be achieved by intersecting our polygons and only keeping the
data that overlaps. Think of this like an `inner join` on two SQL
tables.

    detroit_census_tracts = st_intersection(detroit, wayne_county)

    ## Error in geos_op2_geom("intersection", x, y, ...): st_crs(x) == st_crs(y) is not TRUE

Whoops! Looks like we’re dealing with two different coordinate reference
systems (CRS). I’m not overly interested in learning how the various CRS
systems work, so I’m going to sort of skip the part where I’d start
reading about what this is and how it’s affecting my work. Again, if
this were for an investigation going to court, and I was expected to
explain my analyses, you can bet your ass I’d be digging into CRS. But
this is a blog post and we all have better things to do. So let’s just
figure out which CRS each object is using and choose one to make them
the same.

    print(st_crs(detroit))

    ## Coordinate Reference System:
    ##   User input: WGS 84 
    ##   wkt:
    ## GEOGCRS["WGS 84",
    ##     DATUM["World Geodetic System 1984",
    ##         ELLIPSOID["WGS 84",6378137,298.257223563,
    ##             LENGTHUNIT["metre",1]]],
    ##     PRIMEM["Greenwich",0,
    ##         ANGLEUNIT["degree",0.0174532925199433]],
    ##     CS[ellipsoidal,2],
    ##         AXIS["latitude",north,
    ##             ORDER[1],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##         AXIS["longitude",east,
    ##             ORDER[2],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##     ID["EPSG",4326]]

    print(st_crs(wayne_county))

    ## Coordinate Reference System:
    ##   User input: NAD83 
    ##   wkt:
    ## GEOGCRS["NAD83",
    ##     DATUM["North American Datum 1983",
    ##         ELLIPSOID["GRS 1980",6378137,298.257222101,
    ##             LENGTHUNIT["metre",1]]],
    ##     PRIMEM["Greenwich",0,
    ##         ANGLEUNIT["degree",0.0174532925199433]],
    ##     CS[ellipsoidal,2],
    ##         AXIS["latitude",north,
    ##             ORDER[1],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##         AXIS["longitude",east,
    ##             ORDER[2],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##     ID["EPSG",4269]]

WGS 84 is a CRS that I recognize from the limited geospatial work I’ve
done in the past, so I’m going to choose that one, which means we’ll
need to transform our `wayne_county` object.

    wayne_county_wgs84 <- st_transform(wayne_county, crs=st_crs(detroit))
    print(st_crs(wayne_county_wgs84))

    ## Coordinate Reference System:
    ##   User input: WGS 84 
    ##   wkt:
    ## GEOGCRS["WGS 84",
    ##     DATUM["World Geodetic System 1984",
    ##         ELLIPSOID["WGS 84",6378137,298.257223563,
    ##             LENGTHUNIT["metre",1]]],
    ##     PRIMEM["Greenwich",0,
    ##         ANGLEUNIT["degree",0.0174532925199433]],
    ##     CS[ellipsoidal,2],
    ##         AXIS["latitude",north,
    ##             ORDER[1],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##         AXIS["longitude",east,
    ##             ORDER[2],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##     ID["EPSG",4326]]

Assuming that that’s all we need to do, we should be able to do our
intersection now.

    detroit_census_tracts = st_intersection(detroit, wayne_county_wgs84)

    ## Warning: attribute variables are assumed to be spatially constant throughout all
    ## geometries

And we should now be able to plot it.

    ggplot() +
        geom_sf(data=detroit_census_tracts) +
        theme(
            panel.grid.major=element_blank(), 
            panel.grid.minor=element_blank(),
            panel.background=element_blank(),
            axis.text.x=element_blank(),
            axis.ticks.x=element_blank(),
            axis.text.y=element_blank(),
            axis.ticks.y=element_blank()
        ) +
        labs(x="Detroit Census Tracts")

![](/assets/posts/0001-01-05-testing-hypotheses_files/figure-markdown_strict/plot_detroit_census-1.png)

Nailed it! Lastly, we need to grab the population data for each census
tract. We can use the `tidycensus` package for this, which is an R
package designed to facilitate the process of acquiring and working with
US Census Bureau population data in the R environment
<sub>[1](https://walker-data.com/census-r/an-introduction-to-tidycensus.html)</sub>.
Identifying the variable to use for general population estimates is a
bit of a pain in the ass, but the short answer is that `B01001_001`
should get us what we need. We’re also using the year 2020 because
that’s the latest year for which the 5-year ACS was run.

    wayne_population <- get_acs(
        geography="tract",
        variables="B01001_001",
        state="MI",
        county="Wayne",
        year=2020
    )

    ## Getting data from the 2016-2020 5-year ACS
    ## Error in get_acs(geography = "tract", variables = "B01001_001", state = "MI",  : 
    ## A Census API key is required.  Obtain one at http://api.census.gov/data/key_signup.html, and then supply the key to the `census_api_key()` function to use it throughout your tidycensus session.

Ah, we need an API key. Let’s set that up really quick by first [signing
up](http://api.census.gov/data/key_signup.html), and then installing the
key as recommended by the error message.

    census_api_key(key="<INSERT YOUR KEY HERE>", install=TRUE)

If successful, you should see a message akin to this:

    Your API key has been stored in your .Renviron and can be accessed by Sys.getenv("CENSUS_API_KEY"). 
    To use now, restart R or run `readRenviron("~/.Renviron")`
    [1] "<YOUR API KEY>"

Now that we have our API key and have run `readRenviron("~/.Renviron")`
as recommended in the output above, we should be able to get back to the
business at hand.

    wayne_population <- get_acs(
        geography="tract",
        variables="B01001_001",
        state="MI",
        county="Wayne",
        year=2020
    )

    ## Getting data from the 2016-2020 5-year ACS

    head(wayne_population)

    ## # A tibble: 6 × 5
    ##   GEOID       NAME                                      variable   estim…¹   moe
    ##   <chr>       <chr>                                     <chr>        <dbl> <dbl>
    ## 1 26163500100 Census Tract 5001, Wayne County, Michigan B01001_001    3417   606
    ## 2 26163500200 Census Tract 5002, Wayne County, Michigan B01001_001    2852   541
    ## 3 26163500300 Census Tract 5003, Wayne County, Michigan B01001_001    1657   332
    ## 4 26163500400 Census Tract 5004, Wayne County, Michigan B01001_001    1322   384
    ## 5 26163500500 Census Tract 5005, Wayne County, Michigan B01001_001    1233   229
    ## 6 26163500600 Census Tract 5006, Wayne County, Michigan B01001_001    2707   578
    ## # … with abbreviated variable name ¹​estimate

So, it looks like we’ll need to intersect this data with our census
tracts to only get the population estimates for Detroit census tracts.
Since each row in the acs data should be a census tract, we should be
able to do a simple join on the two data sets to get what we need.

    detroit_census_with_pop <- wayne_population |>
        select(GEOID, estimate) |>
        right_join(detroit_census_tracts, by="GEOID")

    ggplot() +
        geom_sf(data=detroit_census_with_pop, aes(geometry=geometry, fill=estimate)) +
        scale_fill_viridis_c() +
        theme(
            panel.grid.major=element_blank(), 
            panel.grid.minor=element_blank(),
            panel.background=element_blank(),
            axis.text.x=element_blank(),
            axis.ticks.x=element_blank(),
            axis.text.y=element_blank(),
            axis.ticks.y=element_blank(),
            legend.position="bottom"
        ) +
        labs(x="2020 Estimated Detroit Population by Census Tract")

![](/assets/posts/0001-01-05-testing-hypotheses_files/figure-markdown_strict/add_population_data-1.png)

Voila! We now have all of the data that we need to conduct our
simulation.

> Note: If you run sum(detroit\_census\_with\_pop$estimate) you’ll see
> that the results come out to approximately 816,000, which doesn’t
> match what you get if you Google “Detroit population 2020”. Again,
> we’re just testing a hypothesis, so we don’t need everything to be
> exact, but this data point is somewhat concerning. I’m going to ignore
> it for the sake of this post, but this is a data point that I’d
> definitely want to clear up in the real world.

## The Analysis

Our next step is to figure out how to place a point somewhere on our map
using the estimated population for each census tract to help us choose
where our hypothetical people live. If we look at the first example in
[this blog
post](https://r-spatial.github.io/sf/reference/st_sample.html), we can
see that we can sample points within an `sf` object, and the beauty of
the `sf` package is that it gives us an easy way to convert our `tibble`
to an `sf` object using `st_as_sf()`. If we mimic the example in the
blog post, we can start to get an idea of how we can place our points.

    detroit_sf_sample <- st_as_sf(detroit_census_with_pop[1:3, ]) # take the first three census tracts
    points <- st_sample(detroit_sf_sample, 3, exact=TRUE)
    ggplot() +
        geom_sf(data=st_geometry(detroit_sf_sample)) +
        geom_sf(data=points) +
        theme(
            panel.grid.major=element_blank(), 
            panel.grid.minor=element_blank(),
            panel.background=element_blank(),
            axis.text.x=element_blank(),
            axis.ticks.x=element_blank(),
            axis.text.y=element_blank(),
            axis.ticks.y=element_blank(),
            legend.position="bottom"
        ) +
        labs(x="Random Sample of 3 Points in 3 Census Tracts")

![](/assets/posts/0001-01-05-testing-hypotheses_files/figure-markdown_strict/sample_example-1.png)

As we can see, given a set of census tracts, the `sf` package can
randomly place points inside of those boundaries for us, which is
exactly what we’re trying to do. However, instead of simply taking the
first three census tracts in our data, we should randomly sample the
data based on the population, which we’ll use as a weight. Once we have
the census tract, we can generate a single point in there, and then
repeat the process two more times. To simplify this, we can write a
function that we’ll call in our final simulation.

    generate_point <- function(data) {
        census_tract <- data |>
            sample_n(size=1, weight=estimate) |>
            st_as_sf()

        point <- st_sample(census_tract, 1, exact=TRUE)
        return(point)
    }

So, with that, we should be able to call this function three times,
keeping track of each point, and then plot all of the data on a single
map.

    p1 <- generate_point(detroit_census_with_pop)
    p2 <- generate_point(detroit_census_with_pop)
    p3 <- generate_point(detroit_census_with_pop)

    ggplot() +
        geom_sf(data=detroit_census_with_pop, aes(geometry=geometry)) +
        geom_sf(data=p1) +
        geom_sf(data=p2) +
        geom_sf(data=p3) +
        theme(
            panel.grid.major=element_blank(), 
            panel.grid.minor=element_blank(),
            panel.background=element_blank(),
            axis.text.x=element_blank(),
            axis.ticks.x=element_blank(),
            axis.text.y=element_blank(),
            axis.ticks.y=element_blank()
        ) +
        labs(x="Detroit Census Tracts w/ 3 Weighted Random Sampled Addresses")

![](/assets/posts/0001-01-05-testing-hypotheses_files/figure-markdown_strict/single_iteration-1.png)

All that is left now is to calculate the distance between each pair of
points. As mentioned above, I’m going to opt for the Haversine Distance,
despite the fact that it’s likely not the correct distance metric to use
here. Wikipedia has an [article on the Haversine
Distance](https://en.wikipedia.org/wiki/Haversine_formula) that gives us
the following formula.

![](/assets/posts/0001-01-05-testing-hypotheses_files/haversine_formula.png)

Thankfully for us, because I’m not a math wizard, we already found that
StackOverflow post that tells us how to turn this into code. So let’s do
that.

    calculate_distance <- function(p1, p2) {
        a <- 3963.1905919 # equitorial radius in mi
        b <- 3949.902569 # polar radius in mi
        
        p1_coords <- st_coordinates(p1)
        p2_coords <- st_coordinates(p2)
        lat1 <- p1_coords[2]
        lat2 <- p2_coords[2]
        lon1 <- p1_coords[1]
        lon2 <- p2_coords[1]
        
        # convert to radians
        lat1 <- (pi / 180) * lat1
        lat2 <- (pi / 180) * lat2
        lon1 <- (pi / 180) * lon1
        lon2 <- (pi / 180) * lon2
        
        # radius of earth at lat1
        R1 <- (
            (
                (
                    ((a ** 2) * cos(lat1)) ** 2
                ) + 
                (
                    ((b ** 2) * sin(lat1)) ** 2
                )
            ) / 
            (
                (a * cos(lat1)) ** 2 + (b * sin(lat1)) ** 2
            )
        ) ** 0.5
        
        x1 <- R1 * cos(lat1) * cos(lon1)
        y1 <- R1 * cos(lat1) * sin(lon1)
        z1 <- R1 * sin(lat1)

        # radius of earth at lat2
        R2 <- (
            (
                (
                    ((a ** 2) * cos(lat2)) ** 2
                ) + 
                (
                    ((b ** 2) * sin(lat2)) ** 2
                )
            ) / 
            (
                (a * cos(lat2)) ** 2 + (b * sin(lat2)) ** 2
            )
        ) ** 0.5
        
        x2 <- R2 * cos(lat2) * cos(lon2)
        y2 <- R2 * cos(lat2) * sin(lon2)
        z2 <- R2 * sin(lat2)
        
        d <- ((x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2) ** 0.5
        return(d)
    }

    p1 <- generate_point(detroit_census_with_pop)
    p2 <- generate_point(detroit_census_with_pop)

    print(
        paste(
            c("These two points are", calculate_distance(p1, p2), "miles apart"),
            collapse=" "
        )
    )

    ## [1] "These two points are 2.99748006391263 miles apart"

With that in place, we should now be able to generate three points and
calculate the distance between them.

    main <- function(data) {
        p1 <- generate_point(data)
        p2 <- generate_point(data)
        p3 <- generate_point(data)
        
        d_12 <- calculate_distance(p1, p2)
        d_13 <- calculate_distance(p1, p3)
        d_23 <- calculate_distance(p2, p3)
        
        avg_distance <- (d_12 + d_13 + d_23) / 3
        
        return(avg_distance)
    }

And now the only thing left to do is run the simulation.

    avg_distances = c()
    for (i in 1:1e3) {
        avg_distances <- c(avg_distances, main(detroit_census_with_pop))
    }

    hist(avg_distances, title="Histogram of Average Distances (n=1e3)")

    ## Warning in plot.window(xlim, ylim, "", ...): "title" is not a graphical
    ## parameter

    ## Warning in title(main = main, sub = sub, xlab = xlab, ylab = ylab, ...): "title"
    ## is not a graphical parameter

    ## Warning in axis(1, ...): "title" is not a graphical parameter

    ## Warning in axis(2, at = yt, ...): "title" is not a graphical parameter

![](/assets/posts/0001-01-05-testing-hypotheses_files/figure-markdown_strict/monte_carlo_simulation-1.png)
\## The Conclusion

We’ve now run our simulation one thousand times and grabbed the average
distance each time. From here, we can simply calculate what percentage
of the distances are less than or equal to 3.

    mean(avg_distances <= 3)

    ## [1] 0.033

With that calculation, we’re now prepared to answer the question we
posed above:

**What is the probability that three individuals chosen at random from
this city would live within 3 miles of each other?**

With a probability of 3.3%, we’d likely conclude that this is relatively
rare and likely worth looking into. For the case I worked back in 2016,
we decided that it was not worth pursuing as the probability was about
25% in that scenario. But regardless of the outcome, we’ve just
quantified whether or not it’s worth looking into with nothing more than
a couple of quick calculations. Testing your hypotheses can save you a
ton of time, and also provide justification for decisions you’ve made in
your case. Hopefully this post gives you some ideas of hypotheses you could be
testing in your own environment.
